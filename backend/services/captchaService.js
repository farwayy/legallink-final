const svgCaptcha = require('svg-captcha');

// Store captcha in memory (use Redis in production)
const captchaStore = new Map();

const generateCaptcha = (sessionId) => {
  const captcha = svgCaptcha.create({
    size: 6,
    noise: 2,
    color: true,
    background: '#f0f0f0'
  });
  
  captchaStore.set(sessionId, {
    text: captcha.text.toLowerCase(),
    expires: Date.now() + 5 * 60 * 1000
  });
  
  return captcha.data;
};

const verifyCaptcha = (sessionId, userInput) => {
  const stored = captchaStore.get(sessionId);
  if (!stored) return false;
  if (stored.expires < Date.now()) return false;
  return stored.text === userInput.toLowerCase();
};

module.exports = { generateCaptcha, verifyCaptcha };