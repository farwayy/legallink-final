// frontend/src/contexts/RealTimeContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_ORIGIN } from "../config";

const RealTimeContext = createContext();

export const useRealTime = () => useContext(RealTimeContext);

export const RealTimeProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { user, logout, refreshUser } = useAuth();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // The server checks this sign-in token, so nobody can listen in as someone else
    const newSocket = io(`${API_ORIGIN}`, { auth: { token: localStorage.getItem('token') } });
    setSocket(newSocket);
    setIsConnected(true);

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('register', user.id);
    });

    newSocket.on('server-update', (update) => {
      console.log('Server update:', update);
      handleServerUpdate(update);
    });

    newSocket.on('force-logout', (data) => {
      console.log('Force logout:', data);
      // Shown on the sign-in page (instead of a browser pop-up)
      try {
        sessionStorage.setItem('ll_signed_out_reason', data.message || 'Your session has ended. Please sign in again.');
      } catch (e) {
        /* ignore */
      }
      logout();
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const handleServerUpdate = useCallback(async (update) => {
    // Add to notifications
    setNotifications(prev => [update, ...prev]);

    // Show toast message
    showToast(update.data.message, update.type);

    switch (update.type) {
      case 'ACCOUNT_SUSPENDED':
      case 'ACCOUNT_BLOCKED':
        setTimeout(() => logout(), 2000);
        break;
      case 'ROLE_CHANGED':
        setTimeout(() => logout(), 3000);
        break;
      case 'VERIFICATION_STATUS':
        await refreshUser();
        if (update.data.requiresRefresh) {
          setTimeout(() => window.location.reload(), 2000);
        }
        break;
      case 'CASE_UPDATED':
        // Refresh case data if needed
        break;
      case 'FORCE_REFRESH':
        setTimeout(() => window.location.reload(), 1000);
        break;
      default:
        break;
    }
  }, [logout, refreshUser]);

  const showToast = (message, type) => {
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message, type: type.toLowerCase() } 
    }));
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));
  };

  const value = {
    socket,
    isConnected,
    notifications,
    markAsRead,
    showToast
  };

  return (
    <RealTimeContext.Provider value={value}>
      {children}
    </RealTimeContext.Provider>
  );
};