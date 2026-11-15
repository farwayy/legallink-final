const User = require('../models/User');
const Lawyer = require('../models/Lawyer');
const NGO = require('../models/NGO');
const Notification = require('../models/Notification');
const { sendCaseResolvedReviewPromptEmail } = require('./verificationService');

/**
 * Triggers proactive review prompt (email + in-app notification)
 * when a case is marked as resolved by a Lawyer or NGO.
 * 
 * @param {Object} caseData - The Mongoose Case document
 * @param {Object} [realTimeManager] - Socket.io real-time manager instance from req.app
 */
async function triggerCaseResolvedReviewPrompt(caseData, realTimeManager) {
  try {
    if (!caseData || !['resolved', 'closed'].includes(caseData.status)) return;

    // 1. Fetch Citizen (Client) details
    const citizen = await User.findById(caseData.userId);
    if (!citizen || !citizen.email) {
      console.log(`⚠️ Citizen record or email missing for resolved/closed case ${caseData._id}`);
      return;
    }

    // 2. Resolve Counsel Information (Lawyer vs NGO)
    let counselName = 'Legal Counsel';
    let counselType = 'Advocate';

    if (caseData.lawyerId) {
      const lawyer = await Lawyer.findById(caseData.lawyerId);
      if (lawyer) {
        counselName = lawyer.name || 'Advocate';
        counselType = 'Legal Counsel (Advocate)';
      }
    } else if (caseData.ngoId) {
      const ngo = await NGO.findById(caseData.ngoId);
      if (ngo) {
        counselName = ngo.name || 'Legal Aid Society';
        counselType = 'Legal Aid Society (NGO)';
      }
    }

    const caseTitle = caseData.title || 'Legal Representation Matter';
    const actionUrl = `/user/dashboard?action=review&caseId=${caseData._id}`;
    const statusLabel = caseData.status === 'closed' ? 'closed' : 'resolved';
    const notificationMessage = `Your case "${caseTitle}" with ${counselName} has been marked ${statusLabel} — share your experience.`;

    // 3. Dispatch Proactive Review Prompt Email
    try {
      await sendCaseResolvedReviewPromptEmail({
        email: citizen.email,
        citizenName: citizen.name,
        counselName,
        counselType,
        caseTitle,
        caseId: caseData._id
      });
      console.log(`📧 Proactive review prompt email dispatched to citizen: ${citizen.email}`);
    } catch (emailErr) {
      console.error(`❌ Failed to send review prompt email to ${citizen.email}:`, emailErr);
    }

    // 4. In-App Notification (Socket.io Real-Time + Database record)
    try {
      if (realTimeManager && typeof realTimeManager.notifyUser === 'function') {
        await realTimeManager.notifyUser(citizen._id.toString(), 'CASE_RESOLVED', {
          message: notificationMessage,
          caseId: caseData._id,
          actionUrl,
          counselName,
          counselType,
          requiresAction: true,
          timestamp: Date.now()
        });
        console.log(`🔔 In-app review prompt notification pushed via socket to citizen ${citizen._id}`);
      } else {
        // Direct Database fallback if socket manager is not available
        const notification = new Notification({
          userId: citizen._id,
          userType: 'User',
          type: 'CASE_RESOLVED',
          title: 'Case Marked Resolved',
          message: notificationMessage,
          data: {
            caseId: caseData._id,
            actionUrl,
            counselName,
            counselType
          },
          requiresAction: true
        });
        await notification.save();
        console.log(`🔔 In-app review prompt notification saved to DB for citizen ${citizen._id}`);
      }
    } catch (notifErr) {
      console.error(`❌ Failed to deliver in-app review notification:`, notifErr);
    }
  } catch (error) {
    console.error(`❌ Unexpected error in triggerCaseResolvedReviewPrompt:`, error);
  }
}

module.exports = {
  triggerCaseResolvedReviewPrompt
};
