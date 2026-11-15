/**
 * Representation packages and their fees (PKR).
 * The server always uses these amounts; the amount sent by the browser is ignored,
 * so nobody can change the price they pay.
 */
const PACKAGES = {
  gold: { label: 'Gold', fee: 25000 },
  platinum: { label: 'Platinum', fee: 45000 }
};

const feeFor = (packageType) => (PACKAGES[packageType] || PACKAGES.gold).fee;
const labelFor = (packageType) => (PACKAGES[packageType] || PACKAGES.gold).label;

module.exports = { PACKAGES, feeFor, labelFor };
