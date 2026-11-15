const path = require('path');
const dotenv = require('dotenv');

// Explicitly load .env from backend directory immediately upon module evaluation
dotenv.config({ path: path.join(__dirname, '../.env') });

const nodemailer = require('nodemailer');

// ── Email Transporter Setup ────────────────────────────────────────────────
// Dynamically creates transporter using current environment credentials
const getTransporter = () => {
  // Always refresh from .env so disk updates are immediately reflected without requiring server restart
  dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '';

  // Server-side diagnostic log (never sent to client)
  console.log(`[SMTP CONFIG] Transporter created | EMAIL_USER: "${user}" | EMAIL_PASS length: ${pass ? pass.length : 0} | service: 'gmail'`);

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass
    }
  });
};

// ── Safe Mail Sender Wrapper ──────────────────────────────────────────────
const sendMailSafe = async (mailOptions) => {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [EMAIL SUCCESS] Sent to: ${mailOptions.to} | Subject: "${mailOptions.subject}" | MessageId: ${info.messageId} | Response: ${info.response}`);
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    // Print the FULL raw error object from Nodemailer
    console.error(`\n❌ [SMTP RAW ERROR] Failed to send email to ${mailOptions.to}:`, {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command,
      stack: error.stack
    });

    return { 
      success: false, 
      error: error.message, 
      code: error.code, 
      response: error.response 
    };
  }
};

// ── Email HTML Layout Builder ─────────────────────────────────────────────
const buildProfessionalEmailHtml = ({
  heading,
  badgeText,
  badgeColor = '#0284c7',
  badgeBg = '#e0f2fe',
  badgeBorder = '#bae6fd',
  introParagraph,
  detailsTable = [], // Array of { label, value }
  calloutBox = null,  // { title, text, bg, border, color }
  ctaButton = null,   // { label, url }
  footnote = null
}) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  const tableRowsHtml = detailsTable.length > 0 ? `
    <table style="width: 100%; border-collapse: separate; border-spacing: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0; overflow: hidden;">
      <tbody>
        ${detailsTable.map((row, idx) => `
          <tr style="${idx > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
            <td style="padding: 12px 18px; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; width: 38%; border-bottom: ${idx < detailsTable.length - 1 ? '1px solid #e2e8f0' : 'none'};">
              ${row.label}
            </td>
            <td style="padding: 12px 18px; font-weight: 500; color: #0f172a; font-size: 14px; border-bottom: ${idx < detailsTable.length - 1 ? '1px solid #e2e8f0' : 'none'};">
              ${row.value}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  const calloutHtml = calloutBox ? `
    <div style="background-color: ${calloutBox.bg || '#f8fafc'}; border-left: 4px solid ${calloutBox.border || '#0284c7'}; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 22px 0;">
      ${calloutBox.title ? `<strong style="display: block; color: ${calloutBox.color || '#0f172a'}; font-size: 14px; margin-bottom: 4px;">${calloutBox.title}</strong>` : ''}
      <p style="margin: 0; font-size: 13.5px; color: ${calloutBox.color || '#334155'}; line-height: 1.5;">${calloutBox.text}</p>
    </div>
  ` : '';

  const ctaHtml = ctaButton ? `
    <div style="text-align: center; margin: 32px 0 24px 0;">
      <a href="${ctaButton.url}" target="_blank" style="display: inline-block; background-color: #1E3F2E; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 15px; border-radius: 6px; letter-spacing: 0.3px; border: 1px solid #152E22; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        ${ctaButton.label} &rarr;
      </a>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    
    <!-- Top Institutional Banner -->
    <div style="background: linear-gradient(135deg, #1E3F2E 0%, #152E22 100%); padding: 26px 30px; border-bottom: 3px solid #C5A059; text-align: left;">
      <table style="width: 100%; border: none;">
        <tr>
          <td style="vertical-align: middle;">
            <div style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">
              ⚖️ LEGALLINK <span style="color: #C5A059; font-size: 14px; font-weight: 500; text-transform: uppercase; margin-left: 6px; letter-spacing: 1px;">Pakistan</span>
            </div>
            <div style="font-size: 12px; color: #CBD5E1; margin-top: 3px; letter-spacing: 0.3px;">
              National AI-Powered Legal Aid & Pro Bono Network
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Main Content Area -->
    <div style="padding: 34px 32px 28px 32px; background-color: #ffffff;">
      
      <!-- Status Badge -->
      ${badgeText ? `
        <div style="margin-bottom: 18px;">
          <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 5px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            ${badgeText}
          </span>
        </div>
      ` : ''}

      <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.35;">
        ${heading}
      </h1>

      <div style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
        ${introParagraph}
      </div>

      ${tableRowsHtml}

      ${calloutHtml}

      ${ctaHtml}

      ${footnote ? `
        <div style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px;">
          ${footnote}
        </div>
      ` : ''}
    </div>

    <!-- Institutional Footer -->
    <div style="background-color: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.6;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">
        LegalLink — Empowering Equal Access to Justice Across Pakistan
      </p>
      <p style="margin: 0 0 10px 0; color: #94a3b8;">
        This is an official administrative automated message. If you did not initiate this request or have compliance queries, please reach out to <a href="mailto:support@legallink.com" style="color: #0284c7; text-decoration: underline;">support@legallink.com</a>.
      </p>
      <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
        &copy; ${new Date().getFullYear()} LegalLink Pakistan. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `;
};

// ── Generate 6-Digit Random Code ───────────────────────────────────────────
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ═══════════════════════════════════════════════════════════════════════════
//  1. LAWYER VERIFICATION CODE (OTP)
// ═══════════════════════════════════════════════════════════════════════════
const sendVerificationCodes = async (email, phone) => {
  const code = generateCode();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

  console.log(`\n======================================================`);
  console.log(`🔐 [LAWYER EMAIL VERIFICATION CODE]`);
  console.log(`   Recipient: ${email}`);
  console.log(`   Code:      ${code}`);
  console.log(`   Expires:   ${new Date(expiresAt).toLocaleTimeString()}`);
  console.log(`======================================================\n`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>LegalLink Lawyer Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 560px; margin: 30px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 30px; border-bottom: 3px solid #d97706;">
      <div style="font-size: 20px; font-weight: 700; color: #ffffff;">
        ⚖️ LEGALLINK <span style="color: #f59e0b; font-size: 13px; font-weight: 500; text-transform: uppercase; margin-left: 6px;">Pakistan</span>
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Advocate Portal • Identity Verification</div>
    </div>

    <div style="padding: 32px 30px;">
      <div style="margin-bottom: 16px;">
        <span style="background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
          One-Time Passcode (OTP)
        </span>
      </div>

      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">
        Verify Your Email Address
      </h2>
      <p style="font-size: 14.5px; color: #334155; line-height: 1.5; margin: 0 0 24px 0;">
        You are completing your registration for the LegalLink Advocate & Legal Practitioner Network. Use the verification passcode below to complete Step 2 of your registration:
      </p>

      <!-- Code Box -->
      <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 24px; text-align: center; margin: 20px 0;">
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #0f172a; letter-spacing: 10px; display: inline-block;">
          ${code}
        </span>
        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
          ⏱️ This code will expire in <strong>10 minutes</strong>.
        </div>
      </div>

      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-top: 22px;">
        <p style="margin: 0; font-size: 12.5px; color: #92400e; line-height: 1.5;">
          <strong>Security Notice:</strong> Never share this code with anyone. LegalLink administrative staff will never request your verification code or password.
        </p>
      </div>
    </div>

    <div style="background-color: #f8fafc; padding: 18px 30px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; text-align: center;">
      LegalLink Pakistan • Legal Aid & Pro Bono Coordination Service<br>
      If you did not request this verification, please safely ignore this message.
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"LegalLink Support" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `🔐 LegalLink Verification Code: ${code}`,
    html: html
  };

  const result = await sendMailSafe(mailOptions);
  return { code, expiresAt, emailSent: result.success, error: result.error };
};

// ═══════════════════════════════════════════════════════════════════════════
//  2. LAWYER UNDER REVIEW CONFIRMATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════
const sendLawyerUnderReviewNotification = async (email, name, barCouncilId, specialization = []) => {
  const specList = Array.isArray(specialization) ? specialization.join(', ') : specialization || 'General Practice';
  
  const html = buildProfessionalEmailHtml({
    heading: `Advocate Application Received & Under Review`,
    badgeText: `Application Under Review`,
    badgeColor: `#b45309`,
    badgeBg: `#fef3c7`,
    badgeBorder: `#fde68a`,
    introParagraph: `
      Dear <strong>Advocate ${name}</strong>,<br><br>
      Thank you for submitting your application to join the <strong>LegalLink Pro Bono & Legal Aid Practitioner Network</strong>. 
      Your credentials and bar council documentation have been logged into our system and forwarded to the LegalLink Verification Committee.
    `,
    detailsTable: [
      { label: 'Advocate Name', value: name },
      { label: 'Bar Council ID / License', value: barCouncilId || 'Submitted for Verification' },
      { label: 'Areas of Specialization', value: specList },
      { label: 'Current Status', value: '⏳ Pending Bar Verification' },
      { label: 'Estimated Review Time', value: '24 – 48 Business Hours' }
    ],
    calloutBox: {
      title: 'What Happens Next?',
      text: 'Our administrative compliance team verifies your Bar Council credentials against provincial bar records. As soon as your review is complete, you will receive an official approval email granting full access to the LegalLink Lawyer Portal.',
      bg: '#f8fafc',
      border: '#d97706',
      color: '#0f172a'
    },
    footnote: `You can reach our compliance desk at any time by replying with your Bar Council ID to <strong>support@legallink.com</strong>.`
  });

  const mailOptions = {
    from: `"LegalLink Verification" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `⚖️ LegalLink - Advocate Application Received & Under Review`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ═══════════════════════════════════════════════════════════════════════════
//  3. LAWYER APPROVAL NOTIFICATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════
const sendApprovalNotification = async (email, name, phone, barCouncilId) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  
  const html = buildProfessionalEmailHtml({
    heading: `Congratulations! Your Lawyer Account Has Been Approved`,
    badgeText: `Official Verification Complete`,
    badgeColor: `#15803d`,
    badgeBg: `#dcfce7`,
    badgeBorder: `#bbf7d0`,
    introParagraph: `
      Dear <strong>Advocate ${name}</strong>,<br><br>
      We are delighted to inform you that your Bar Council credentials have been officially verified and your <strong>LegalLink Advocate Account</strong> is now active.
      Welcome to Pakistan's premier legal aid and pro bono coordination network.
    `,
    detailsTable: [
      { label: 'Advocate Name', value: name },
      { label: 'Account Status', value: '✅ Verified & Active' },
      { label: 'Portal Access', value: 'Full Pro Bono & Private Consultation Intakes Enabled' }
    ],
    calloutBox: {
      title: 'What You Can Now Do:',
      text: '• Receive matched client requests based on your specialization and jurisdiction.<br>• Accept pro bono cases referred by certified NGOs.<br>• Schedule hearings and communicate securely with clients through encrypted chat.',
      bg: '#f0fdf4',
      border: '#16a34a',
      color: '#14532d'
    },
    ctaButton: {
      label: 'Login to Lawyer Portal',
      url: `${clientUrl}/lawyer/login`
    },
    footnote: `Need assistance getting started? View our onboarding guides or contact <a href="mailto:support@legallink.com" style="color: #0284c7;">support@legallink.com</a>.`
  });

  const mailOptions = {
    from: `"LegalLink Verification" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `✅ LegalLink - Congratulations! Your Advocate Account Has Been Approved`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ═══════════════════════════════════════════════════════════════════════════
//  4. LAWYER REJECTION NOTIFICATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════
const sendRejectionNotification = async (email, name, phone, reason) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  
  const html = buildProfessionalEmailHtml({
    heading: `Update on Your LegalLink Application`,
    badgeText: `Application Status Update`,
    badgeColor: `#b91c1c`,
    badgeBg: `#fee2e2`,
    badgeBorder: `#fca5a5`,
    introParagraph: `
      Dear <strong>Advocate ${name}</strong>,<br><br>
      Thank you for your interest in joining LegalLink. After a thorough review of your submitted credentials by our administrative committee, we are unable to approve your application at this time.
    `,
    detailsTable: [
      { label: 'Applicant Name', value: name },
      { label: 'Decision', value: 'Application Declined / Incomplete' }
    ],
    calloutBox: {
      title: 'Reason for Decision:',
      text: reason || 'Submitted Bar Council documents or identification could not be verified against the official provincial bar registry.',
      bg: '#fef2f2',
      border: '#ef4444',
      color: '#991b1b'
    },
    ctaButton: {
      label: 'Resubmit Your Application',
      url: `${clientUrl}/lawyer/resubmit`
    },
    footnote: `If you believe this decision was made in error or wish to provide amended bar credentials, please email our review board at <a href="mailto:support@legallink.com" style="color: #0284c7;">support@legallink.com</a>.`
  });

  const mailOptions = {
    from: `"LegalLink Verification" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `📋 LegalLink - Important Update on Your Advocate Application`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN REQUESTS MORE INFORMATION (application stays pending)
// ═══════════════════════════════════════════════════════════════════════════
const sendInfoRequestEmail = async ({ email, name, message, kind = 'advocate' }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const html = buildProfessionalEmailHtml({
    heading: `We need a little more information`,
    badgeText: `Application still under review`,
    badgeColor: `#92400e`,
    badgeBg: `#fef3c7`,
    badgeBorder: `#fde68a`,
    introParagraph: `
      Dear <strong>${name}</strong>,<br><br>
      Thank you for applying to LegalLink. Before we can finish reviewing your ${kind === 'organisation' ? 'organisation' : 'advocate'} application, our review team needs the following from you.
    `,
    detailsTable: [
      { label: 'Applicant', value: name },
      { label: 'Status', value: 'Pending — more information needed' }
    ],
    calloutBox: {
      title: 'What we need:',
      text: message,
      bg: '#fffbeb',
      border: '#f59e0b',
      color: '#92400e'
    },
    ctaButton: {
      label: 'Reply to the review team',
      url: `mailto:support@legallink.com?subject=${encodeURIComponent('Application information: ' + name)}`
    },
    footnote: `You can reply to this email with the requested documents. Your application keeps its place in the queue. Visit <a href="${clientUrl}" style="color: #0284c7;">LegalLink</a> for more.`
  });
  return await sendMailSafe({
    from: `"LegalLink Verification" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `LegalLink - More information needed for your application`,
    html
  });
};

// ═══════════════════════════════════════════════════════════════════════════
//  5. NGO UNDER REVIEW CONFIRMATION EMAIL (SENT AFTER NGO REGISTERS)
// ═══════════════════════════════════════════════════════════════════════════
const sendNGOUnderReviewNotification = async ({ email, name, registrationNumber, focalName, city, province }) => {
  const html = buildProfessionalEmailHtml({
    heading: `NGO Registration Received & Under Review`,
    badgeText: `NGO Registration Under Review`,
    badgeColor: `#b45309`,
    badgeBg: `#fef3c7`,
    badgeBorder: `#fde68a`,
    introParagraph: `
      Dear <strong>${name} Team</strong>${focalName ? ` (Attn: ${focalName})` : ''},<br><br>
      Thank you for registering your organization on <strong>LegalLink Pakistan</strong>. We have successfully received your NGO registration submission along with your official registration charter and documentation.
    `,
    detailsTable: [
      { label: 'Organization Name', value: name },
      { label: 'Registration Number', value: registrationNumber },
      { label: 'Focal Person', value: focalName || 'Not specified' },
      { label: 'Jurisdiction / City', value: `${city || ''}, ${province || ''}` },
      { label: 'Verification Status', value: '⏳ Under Administrative Review' },
      { label: 'Estimated Turnaround', value: '24 – 48 Hours' }
    ],
    calloutBox: {
      title: 'Verification In Progress',
      text: 'To protect beneficiaries and uphold legal compliance under Pakistani law, all non-governmental organizations undergo an administrative document review before case-referral capabilities are unlocked. You will receive an official approval email once your verification is completed.',
      bg: '#f8fafc',
      border: '#d97706',
      color: '#0f172a'
    },
    footnote: `Questions about your organization's review status? Contact the NGO Liaison Desk at <a href="mailto:ngo-support@legallink.com" style="color: #0284c7;">ngo-support@legallink.com</a>.`
  });

  const mailOptions = {
    from: `"LegalLink NGO Portal" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `🏛️ LegalLink - NGO Registration Received & Under Review (${name})`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ═══════════════════════════════════════════════════════════════════════════
//  6. NGO APPROVAL NOTIFICATION EMAIL (SENT AFTER ADMIN APPROVES NGO)
// ═══════════════════════════════════════════════════════════════════════════
const sendNGOApprovalNotification = async ({ email, name, registrationNumber, focalName }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  const html = buildProfessionalEmailHtml({
    heading: `Congratulations! Your NGO Account Has Been Approved`,
    badgeText: `Verified Legal Aid Partner`,
    badgeColor: `#15803d`,
    badgeBg: `#dcfce7`,
    badgeBorder: `#bbf7d0`,
    introParagraph: `
      Dear <strong>${name} Team</strong>${focalName ? ` (Attn: ${focalName})` : ''},<br><br>
      We are delighted to confirm that your non-governmental organization has been <strong>officially verified and approved</strong> by the LegalLink Administrative Board.
      Your organization is now recognized as an authorized Legal Aid Partner in the LegalLink ecosystem.
    `,
    detailsTable: [
      { label: 'Organization Name', value: name },
      { label: 'Registration Number', value: registrationNumber },
      { label: 'Partner Status', value: '✅ Verified & Active' },
      { label: 'Directory Visibility', value: 'Publicly Listed in National NGO Directory' }
    ],
    calloutBox: {
      title: 'Features Now Available to Your Organization:',
      text: '• <strong>Pro Bono Case Intake:</strong> Refer indigent and vulnerable citizens for pro bono legal aid.<br>• <strong>Lawyer Network:</strong> Directly connect with verified advocates and bar practitioners across Pakistan.<br>• <strong>Case Management Dashboard:</strong> Track case progress, court milestones, and legal outcomes in real time.',
      bg: '#f0fdf4',
      border: '#16a34a',
      color: '#14532d'
    },
    ctaButton: {
      label: 'Login to NGO Portal',
      url: `${clientUrl}/ngo/login`
    },
    footnote: `Bookmark your portal login link: <a href="${clientUrl}/ngo/login" style="color: #0284c7;">${clientUrl}/ngo/login</a>. For priority institutional support, contact <a href="mailto:ngo-support@legallink.com" style="color: #0284c7;">ngo-support@legallink.com</a>.`
  });

  const mailOptions = {
    from: `"LegalLink NGO Portal" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `🎉 LegalLink - Your NGO Account Has Been Officially Approved! (${name})`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ═══════════════════════════════════════════════════════════════════════════
//  7. NGO REJECTION NOTIFICATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════
const sendNGORejectionNotification = async ({ email, name, registrationNumber, focalName, reason }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  const html = buildProfessionalEmailHtml({
    heading: `Update Regarding Your NGO Registration`,
    badgeText: `Registration Status Update`,
    badgeColor: `#b91c1c`,
    badgeBg: `#fee2e2`,
    badgeBorder: `#fca5a5`,
    introParagraph: `
      Dear <strong>${name} Team</strong>${focalName ? ` (Attn: ${focalName})` : ''},<br><br>
      Thank you for your registration submission on LegalLink. Following our compliance verification of the official registration documents and NGO charter, we regret to inform you that your registration could not be verified at this stage.
    `,
    detailsTable: [
      { label: 'Organization Name', value: name },
      { label: 'Registration Number', value: registrationNumber || 'N/A' },
      { label: 'Status', value: 'Application Incomplete / Needs Correction' }
    ],
    calloutBox: {
      title: 'Reason for Incomplete Status:',
      text: reason || 'The official registration certificate or constitutional documents submitted were either illegible, expired, or could not be validated with the relevant regulatory authorities.',
      bg: '#fef2f2',
      border: '#ef4444',
      color: '#991b1b'
    },
    ctaButton: {
      label: 'Resubmit Your Registration',
      url: `${clientUrl}/ngo/resubmit`
    },
    footnote: `To appeal this finding or attach supplementary registration certificates, please contact our Compliance Desk at <a href="mailto:support@legallink.com" style="color: #0284c7;">support@legallink.com</a>.`
  });

  const mailOptions = {
    from: `"LegalLink NGO Portal" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `📋 LegalLink - Important Update on Your NGO Registration (${name})`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ═══════════════════════════════════════════════════════════════════════════
//  8. USER / CITIZEN WELCOME EMAIL
// ═══════════════════════════════════════════════════════════════════════════
const sendUserWelcomeNotification = async ({ email, name }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  const html = buildProfessionalEmailHtml({
    heading: `Welcome to LegalLink Pakistan`,
    badgeText: `Citizen Account Active`,
    badgeColor: `#0284c7`,
    badgeBg: `#e0f2fe`,
    badgeBorder: `#bae6fd`,
    introParagraph: `
      Dear <strong>${name}</strong>,<br><br>
      Welcome to <strong>LegalLink</strong>. Your account has been registered successfully. You now have direct access to legal aid services, legal AI assistance, and verified bar council practitioners across Pakistan.
    `,
    calloutBox: {
      title: 'What You Can Do on LegalLink:',
      text: '• Consult with our 24/7 AI Legal Assistant for immediate statutory guidance.<br>• Browse verified advocates by province, practice area, and language.<br>• Submit pro bono legal aid inquiries to registered non-profit organizations.',
      bg: '#f8fafc',
      border: '#0284c7',
      color: '#0f172a'
    },
    ctaButton: {
      label: 'Explore Legal Services',
      url: `${clientUrl}/`
    }
  });

  const mailOptions = {
    from: `"LegalLink" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `⚖️ Welcome to LegalLink - Your Access to Justice Portal`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ═══════════════════════════════════════════════════════════════════════════
//  PASSWORD RESET NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════
const sendPasswordResetEmail = async ({ email, name, role, rawToken }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password?token=${rawToken}&role=${encodeURIComponent(role)}`;

  const roleLabels = {
    user: 'Citizen / Client',
    lawyer: 'Legal Counsel / Advocate',
    ngo: 'Legal Aid Society (NGO)',
    admin: 'System Administrator'
  };
  const roleLabel = roleLabels[role] || 'Account Member';

  const html = buildProfessionalEmailHtml({
    heading: `Reset Your LegalLink Password`,
    badgeText: `Security Notification`,
    badgeColor: `#b45309`,
    badgeBg: `#fef3c7`,
    badgeBorder: `#fde68a`,
    introParagraph: `
      Dear <strong>${name || 'LegalLink User'}</strong>,<br><br>
      We received a request to reset the password for your <strong>LegalLink ${roleLabel}</strong> account associated with <strong>${email}</strong>.
    `,
    detailsTable: [
      { label: 'Account Type', value: roleLabel },
      { label: 'Authorized Email', value: email },
      { label: 'Link Expiry', value: '30 Minutes from receipt' }
    ],
    calloutBox: {
      title: 'Security Notice',
      text: 'This link will automatically expire in <strong>30 minutes</strong> and can only be used once. If you did not make this request, you can safely ignore this email — your existing password remains secure.',
      bg: '#fffbeb',
      border: '#f59e0b',
      color: '#92400e'
    },
    ctaButton: {
      label: 'Reset My Password',
      url: resetUrl
    },
    footnote: `
      If the button above does not work, copy and paste this link into your web browser:<br>
      <a href="${resetUrl}" style="color: #0284c7; word-break: break-all;">${resetUrl}</a>
    `
  });

  const mailOptions = {
    from: `"LegalLink Security" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `⚖️ Reset Your LegalLink Password (${roleLabel})`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ── Case Resolved Proactive Review Prompt Email ─────────────────────────────
const sendCaseResolvedReviewPromptEmail = async ({
  email,
  citizenName,
  counselName,
  counselType = 'Advocate',
  caseTitle,
  caseId
}) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const reviewUrl = `${clientUrl}/user/dashboard?action=review&caseId=${caseId}`;

  const html = buildProfessionalEmailHtml({
    heading: `Case Marked Resolved — Share Your Experience`,
    badgeText: `Verified Review Request`,
    badgeColor: `#15803d`,
    badgeBg: `#dcfce7`,
    badgeBorder: `#86efac`,
    introParagraph: `
      Dear <strong>${citizenName || 'Citizen'}</strong>,<br><br>
      Your legal matter <strong>"${caseTitle || 'Legal Representation'}"</strong> with <strong>${counselName || 'Legal Counsel'}</strong> (${counselType}) has been officially marked as <strong>Resolved</strong> on the LegalLink portal.
    `,
    detailsTable: [
      { label: 'Matter Title', value: caseTitle || 'Legal Matter' },
      { label: 'Assigned Counsel', value: counselName || 'Legal Counsel' },
      { label: 'Counsel Category', value: counselType },
      { label: 'Case Status', value: 'Resolved (Closed)' }
    ],
    calloutBox: {
      title: 'Your Feedback Helps Build Trust',
      text: 'Because your case is successfully concluded, you are eligible to publish an authentic client review. Your feedback directly informs other citizens seeking reliable legal counsel across Pakistan.',
      bg: '#f0fdf4',
      border: '#16a34a',
      color: '#166534'
    },
    ctaButton: {
      label: 'Submit Verified Client Review',
      url: reviewUrl
    },
    footnote: `
      Reviews can be edited within 48 hours of initial submission. To review your matter, visit your citizen dashboard:<br>
      <a href="${reviewUrl}" style="color: #1E3F2E; word-break: break-all; font-weight: 600;">${reviewUrl}</a>
    `
  });

  const mailOptions = {
    from: `"LegalLink Case Management" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `⚖️ Your case with ${counselName} has been marked resolved — share your experience`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ── Representation Inquiry Accepted Email ──────────────────────────────────
const sendInquiryAcceptedEmail = async ({
  email,
  citizenName,
  lawyerName,
  packageType = 'gold',
  amount = 25000,
  requestId
}) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const checkoutUrl = `${clientUrl}/user/dashboard`;

  const html = buildProfessionalEmailHtml({
    heading: `Representation Inquiry Accepted!`,
    badgeText: `Inquiry Accepted — Awaiting Payment`,
    badgeColor: `#15803d`,
    badgeBg: `#dcfce7`,
    badgeBorder: `#86efac`,
    introParagraph: `
      Dear <strong>${citizenName || 'Citizen'}</strong>,<br><br>
      Advocate <strong>${lawyerName || 'Legal Counsel'}</strong> has accepted your representation inquiry! Please complete payment to activate your case and open your private case docket.
    `,
    detailsTable: [
      { label: 'Advocate', value: lawyerName || 'Legal Counsel' },
      { label: 'Selected Package', value: `${(packageType || 'gold').toUpperCase()} Package` },
      { label: 'Retainer Fee', value: `PKR ${Number(amount || 0).toLocaleString()}` },
      { label: 'Status', value: 'Accepted — Awaiting Payment' }
    ],
    calloutBox: {
      title: 'Next Step: Activate Your Case',
      text: 'Your counsel has verified availability for your matter. Once your retainer fee is completed via the LegalLink portal, your active case file will be automatically generated with full private messaging and document exchange.',
      bg: '#f0fdf4',
      border: '#16a34a',
      color: '#166534'
    },
    ctaButton: {
      label: 'Complete Payment & Activate Case',
      url: checkoutUrl
    },
    footnote: `
      You can review this offer and simulate test payment directly from your citizen dashboard:<br>
      <a href="${checkoutUrl}" style="color: #1E3F2E; word-break: break-all; font-weight: 600;">${checkoutUrl}</a>
    `
  });

  const mailOptions = {
    from: `"LegalLink Intake Desk" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `⚖️ Advocate ${lawyerName} has accepted your representation inquiry!`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};

// ── Representation Inquiry Declined Email ──────────────────────────────────
const sendInquiryDeclinedEmail = async ({
  email,
  citizenName,
  lawyerName,
  reason
}) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const directoryUrl = `${clientUrl}/lawyers`;

  const html = buildProfessionalEmailHtml({
    heading: `Inquiry Intake Notice`,
    badgeText: `Inquiry Declined`,
    badgeColor: `#475569`,
    badgeBg: `#F1F5F9`,
    badgeBorder: `#CBD5E1`,
    introParagraph: `
      Dear <strong>${citizenName || 'Citizen'}</strong>,<br><br>
      Advocate <strong>${lawyerName || 'Legal Counsel'}</strong> was unable to accept your inquiry at this time.
    `,
    detailsTable: [
      { label: 'Advocate', value: lawyerName || 'Legal Counsel' },
      { label: 'Decision', value: 'Representation Unavailable' },
      { label: 'Account Impact', value: 'Zero charges incurred' }
    ],
    calloutBox: {
      title: 'Counsel Note / Reason:',
      text: reason || 'Advocate has indicated current bench capacity or jurisdictional constraints. No retainer payment was taken, and your account has incurred zero charges.',
      bg: '#f8fafc',
      border: '#94a3b8',
      color: '#334155'
    },
    ctaButton: {
      label: 'Browse Other Verified Advocates',
      url: directoryUrl
    },
    footnote: `
      You may browse other qualified practitioners on LegalLink across all practice areas:<br>
      <a href="${directoryUrl}" style="color: #1E3F2E; word-break: break-all; font-weight: 600;">${directoryUrl}</a>
    `
  });

  const mailOptions = {
    from: `"LegalLink Intake Desk" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `Update regarding your representation inquiry with Advocate ${lawyerName}`,
    html: html
  };

  return await sendMailSafe(mailOptions);
};


// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN INVITATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════
const ADMIN_ROLE_TEXT = {
  super_admin: 'Super admin: full access, including managing other admins',
  verifier: 'Verifier: reviews and approves advocate and NGO applications',
  moderator: 'Moderator: handles citizens, disputes, reviews and announcements'
};

const sendAdminInviteEmail = async ({ email, role, invitedBy, link, expiresHours = 48 }) => {
  const html = buildProfessionalEmailHtml({
    heading: `You've been invited to the LegalLink admin console`,
    badgeText: `Admin invitation`,
    badgeColor: `#14532d`,
    badgeBg: `#dcfce7`,
    badgeBorder: `#bbf7d0`,
    introParagraph: `
      Hello,<br><br>
      <strong>${invitedBy || 'A LegalLink super admin'}</strong> has invited you to help run LegalLink.
      Use the button below to set your name and password. The link works once and expires in ${expiresHours} hours.
    `,
    detailsTable: [
      { label: 'Email', value: email },
      { label: 'Role', value: ADMIN_ROLE_TEXT[role] || role }
    ],
    ctaButton: { label: 'Accept invitation', url: link },
    footnote: `If you weren't expecting this, you can ignore this email and no account will be created.`
  });
  return await sendMailSafe({
    from: `"LegalLink Admin" <${process.env.EMAIL_USER || 'no-reply@legallink.com'}>`,
    to: email,
    subject: `You're invited to the LegalLink admin console`,
    html
  });
};

module.exports = {
  sendMailSafe,
  sendAdminInviteEmail,
  sendInfoRequestEmail,
  sendVerificationCodes,
  sendApprovalNotification,
  sendRejectionNotification,
  sendLawyerUnderReviewNotification,
  sendNGOUnderReviewNotification,
  sendNGOApprovalNotification,
  sendNGORejectionNotification,
  sendUserWelcomeNotification,
  sendPasswordResetEmail,
  sendCaseResolvedReviewPromptEmail,
  sendInquiryAcceptedEmail,
  sendInquiryDeclinedEmail
};