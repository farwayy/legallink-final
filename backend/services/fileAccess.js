/**
 * Private documents.
 *
 * CNIC scans, Bar Council certificates, NGO registration papers and case
 * evidence can only be opened by people allowed to see them:
 *   - case files: the citizen, the advocate / panel advocate, the NGO, admins
 *   - an advocate's or NGO's registration document: that account, admins
 * Profile photos stay public.
 *
 * Flow: the browser asks GET /api/files/link?src=<stored link> (signed in).
 * If allowed, it gets a link that works for 5 minutes, signed by the server.
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const LINK_MINUTES = 5;
const uploadsDir = path.resolve(__dirname, '../uploads');
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

const secret = () => `${process.env.JWT_SECRET || ''}:files`;
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Local file name from any form we have stored (or null for cloud links)
const localName = (src) => {
  if (!src || typeof src !== 'string') return null;
  const s = src.trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(s)) {
    const m = s.match(/^https?:\/\/[^/]+\/(?:uploads|api\/documents|api\/files\/raw)\/([^?#]+)$/i);
    if (!m) return null;
    return path.basename(decodeURIComponent(m[1]));
  }
  return path.basename(s.replace(/^\/?uploads\//, ''));
};

const isCloud = (src) => /^https:\/\/res\.cloudinary\.com\//i.test(String(src || ''));

// Find what a file belongs to, and whether this person may open it
const canOpen = async (src, user) => {
  if (!src || !user) return false;
  const Case = mongoose.model('Case');
  const Lawyer = mongoose.model('Lawyer');
  const NGO = mongoose.model('NGO');
  const isAdmin = user.role === 'admin';

  // Match the exact stored value, or any stored link ending in the same local file name
  const name = isCloud(src) ? null : localName(src);
  const match = name ? { $regex: `(^|/)${escapeRe(name)}$` } : src;

  const theCase = await Case.findOne({ 'documents.url': match }).select('userId lawyerId ngoId assignments').lean();
  if (theCase) {
    if (isAdmin) return true;
    const me = String(user.id);
    const same = (v) => v && String(v) === me;
    return (
      (user.role === 'user' && same(theCase.userId)) ||
      (user.role === 'lawyer' && (same(theCase.lawyerId) || (theCase.assignments || []).some((a) => a.isCurrent && same(a.lawyerId)))) ||
      (user.role === 'ngo' && same(theCase.ngoId))
    );
  }

  const lawyer = await Lawyer.findOne({ officialDocument: match }).select('_id').lean();
  if (lawyer) return isAdmin || (user.role === 'lawyer' && String(lawyer._id) === String(user.id));

  const ngo = await NGO.findOne({ officialDocument: match }).select('_id').lean();
  if (ngo) return isAdmin || (user.role === 'ngo' && String(ngo._id) === String(user.id));

  // Files that belong to nobody (old samples) are for admins only
  return isAdmin;
};

// ── Signed, expiring links ───────────────────────────────────────────────────
const sign = (src, exp) => crypto.createHmac('sha256', secret()).update(`${src}|${exp}`).digest('hex');

const makeLink = (req, src) => {
  const exp = Math.floor(Date.now() / 1000) + LINK_MINUTES * 60;
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/api/files/view?src=${encodeURIComponent(src)}&exp=${exp}&sig=${sign(src, exp)}`;
};

const checkLink = (src, exp, sig) => {
  if (!src || !exp || !sig) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(src, String(exp));
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// ── Opening the file ─────────────────────────────────────────────────────────
const TYPES = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const typeOf = (name) => TYPES[path.extname(name).toLowerCase().replace('.', '')] || 'application/octet-stream';
const INLINE = /^(application\/pdf|image\/)/;

const sendLocal = (res, name) => {
  const file = path.resolve(uploadsDir, path.basename(name));
  if (!file.startsWith(uploadsDir) || !fs.existsSync(file)) return false;
  const type = typeOf(name);
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `${INLINE.test(type) ? 'inline' : 'attachment'}; filename="${path.basename(name).replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(file).pipe(res);
  return true;
};

// Parts of a Cloudinary link: resource type, delivery type, public id, format
const parseCloud = (src) => {
  const m = String(src).match(/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/(upload|authenticated|private)\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+)$/);
  if (!m) return null;
  const [, resourceType, type, rest] = m;
  const clean = decodeURIComponent(rest.split('?')[0]);
  if (resourceType === 'raw') return { resourceType, type, publicId: clean, format: '' };
  const ext = path.extname(clean);
  return { resourceType, type, publicId: ext ? clean.slice(0, -ext.length) : clean, format: ext.replace('.', '') };
};

// Where the server itself downloads a Cloudinary file from
const cloudSource = (src) => {
  const info = parseCloud(src);
  if (!info || info.type === 'upload') return src; // older public uploads
  const { cloudinary } = require('./cloudinaryService');
  return cloudinary.utils.private_download_url(info.publicId, info.format, {
    resource_type: info.resourceType,
    type: info.type,
    expires_at: Math.floor(Date.now() / 1000) + 120
  });
};

const sendCloud = async (res, src) => {
  const axios = require('axios');
  const upstream = await axios.get(cloudSource(src), { responseType: 'stream', timeout: 20000 });
  const name = path.basename(String(src).split('?')[0]);
  const type = String(upstream.headers['content-type'] || typeOf(name)).split(';')[0];
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `${INLINE.test(type) ? 'inline' : 'attachment'}; filename="${name.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  upstream.data.pipe(res);
};

// ── Public photos (served without signing in) ────────────────────────────────
// A file in /uploads is public only if it's someone's profile photo.
const photoCache = new Map(); // name -> { ok, at }
const isPublicPhoto = async (name) => {
  if (!IMAGE_EXT.test(name)) return false;
  const hit = photoCache.get(name);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.ok;
  const re = { $regex: `(^|/)${escapeRe(name)}$` };
  const models = ['User', 'Lawyer'].filter((m) => mongoose.modelNames().includes(m)).map((m) => mongoose.model(m));
  let ok = false;
  for (const M of models) {
    // eslint-disable-next-line no-await-in-loop
    if (await M.exists({ photo: re })) { ok = true; break; }
  }
  photoCache.set(name, { ok, at: Date.now() });
  if (photoCache.size > 5000) photoCache.clear();
  return ok;
};

// Express middleware placed in front of the /uploads static folder
const guardUploads = async (req, res, next) => {
  try {
    const name = path.basename(decodeURIComponent(req.path || ''));
    if (!name || name === '/' ) return res.status(404).end();
    if (await isPublicPhoto(name)) return next();
    return res.status(404).json({ message: 'Not found. Documents open through LegalLink only.' });
  } catch (e) {
    return res.status(404).end();
  }
};

module.exports = { canOpen, makeLink, checkLink, localName, isCloud, sendLocal, sendCloud, guardUploads, isPublicPhoto, parseCloud, cloudSource };
