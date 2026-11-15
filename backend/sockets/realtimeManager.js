const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');

class RealTimeManager {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map();
    this.setupSocketEvents();
    console.log('✅ RealTime Manager initialized (Manual notification mode)');
  }

  setupSocketEvents() {
    // Only signed-in people can connect. The sign-in token decides who the
    // socket belongs to; the browser can't claim to be someone else.
    this.io.use((socket, next) => {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Sign-in required'));
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.authUserId = String(decoded.id);
        socket.authRole = decoded.role;
        next();
      } catch (e) {
        next(new Error('Sign-in expired'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log('🔌 New client connected:', socket.id);

      // The id sent by the browser is ignored: we use the one from the token
      socket.on('register', async () => {
        const userId = socket.authUserId;
        this.userSockets.set(userId, socket.id);
        socket.userId = userId;
        console.log(`📱 User ${userId} registered`);

        // Send pending notifications
        await this.sendPendingNotifications(userId, socket);
      });

      // Only people on a case (or admins) can listen to its live updates
      socket.on('join-case', async (caseId) => {
        try {
          if (!caseId || !mongoose.isValidObjectId(caseId)) return;
          if (socket.authRole !== 'admin') {
            const Case = mongoose.model('Case');
            const me = socket.authUserId;
            const c = await Case.findById(caseId).select('userId lawyerId ngoId assignments').lean();
            if (!c) return;
            const same = (v) => v && String(v) === me;
            const onCase =
              same(c.userId) || same(c.lawyerId) || same(c.ngoId) ||
              (Array.isArray(c.assignments) && c.assignments.some((a) => a.isCurrent && same(a.lawyerId)));
            if (!onCase) return;
          }
          socket.join(`case:${caseId}`);
          console.log(`🔌 Socket ${socket.id} joined room case:${caseId}`);
        } catch (e) {
          /* ignore */
        }
      });

      socket.on('leave-case', (caseId) => {
        if (caseId) {
          socket.leave(`case:${caseId}`);
          console.log(`🔌 Socket ${socket.id} left room case:${caseId}`);
        }
      });

      socket.on('request-refresh', () => {
        if (socket.userId) {
          this.notifyUser(socket.userId, 'FORCE_REFRESH', {
            message: 'New updates available. Refreshing...',
            timestamp: Date.now()
          });
        }
      });
      
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.userSockets.delete(socket.userId);
          console.log(`📱 User ${socket.userId} disconnected`);
        }
      });
    });
  }

  // Manual notification trigger (called from routes after DB updates)
  async notifyUser(userId, eventType, data) {
    try {
      const User = mongoose.model('User');
      const Lawyer = mongoose.model('Lawyer');
      const NGO = mongoose.model('NGO');
      
      let userType = 'User';
      let userExists = await User.findById(userId);
      if (!userExists) {
        userExists = await Lawyer.findById(userId);
        if (userExists) {
          userType = 'Lawyer';
        } else {
          userExists = await NGO.findById(userId);
          if (userExists) userType = 'NGO';
        }
      }
      
      if (!userExists) {
        console.log(`User ${userId} not found, skipping notification`);
        return;
      }
      
      // Store notification in database
      const notification = new Notification({
        userId,
        userType,
        type: eventType,
        title: this.getNotificationTitle(eventType),
        message: data.message,
        data,
        requiresAction: data.requiresRelogin || data.requiresRefresh || false
      });
      await notification.save();
      
      // Send real-time if user is online
      const socketId = this.userSockets.get(userId);
      if (socketId) {
        this.io.to(socketId).emit('server-update', {
          type: eventType,
          data: { ...data, notificationId: notification._id },
          timestamp: Date.now()
        });
        console.log(`📨 Notification sent to ${userId}: ${eventType}`);
      } else {
        console.log(`📨 Notification stored for offline user ${userId}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error.message);
    }
  }

  async sendPendingNotifications(userId, socket) {
    try {
      const pendingNotifications = await Notification.find({ 
        userId, 
        read: false 
      }).sort({ createdAt: 1 });
      
      for (const notif of pendingNotifications) {
        socket.emit('server-update', {
          type: notif.type,
          data: notif.data,
          timestamp: notif.createdAt,
          notificationId: notif._id
        });
        
        notif.read = true;
        await notif.save();
      }
      
      if (pendingNotifications.length > 0) {
        console.log(`📬 Sent ${pendingNotifications.length} pending notifications to ${userId}`);
      }
    } catch (error) {
      console.error('Error sending pending notifications:', error.message);
    }
  }

  disconnectUser(userId) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('force-logout', {
        message: 'Your session has been terminated by admin',
        reason: 'account_modified'
      });
      console.log(`👋 User ${userId} force disconnected`);
    }
  }

  getNotificationTitle(type) {
    const titles = {
      'ACCOUNT_SUSPENDED': 'Account Suspended',
      'ACCOUNT_BLOCKED': 'Account Blocked',
      'ROLE_CHANGED': 'Role Updated',
      'VERIFICATION_STATUS': 'Verification Update',
      'CASE_UPDATED': 'Case Update',
      'CASE_RESOLVED': 'Case Marked Resolved',
      'REVIEW_PROMPT': 'Share Your Legal Experience',
      'FORCE_REFRESH': 'Refresh Required',
      'NGO_PANEL_INVITE': 'NGO Panel Invitation',
      'NGO_PANEL_RESPONSE': 'Panel Invitation Response',
      'PRO_BONO_ASSIGNMENT': 'Pro Bono Case Assignment',
      'PRO_BONO_UNASSIGNED': 'Counsel Representation Concluded',
      'CASE_REASSIGNED': 'Counsel Assignment Updated'
    };
    return titles[type] || 'Notification';
  }

  // Helper method to notify after database operations
  async notifyAfterUpdate(userId, eventType, message, additionalData = {}) {
    await this.notifyUser(userId, eventType, {
      message,
      ...additionalData,
      timestamp: Date.now()
    });
  }
}

module.exports = RealTimeManager;