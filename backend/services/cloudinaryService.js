const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure local uploads directory exists for fallback
const localUploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

// ── Cloudinary Configuration ────────────────────────────────────────────────
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
};

configureCloudinary();

const isCloudinaryConfigured = () => {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  return Boolean(
    name && key && secret &&
    !name.includes('your_cloudinary') &&
    !key.includes('your_cloudinary') &&
    !secret.includes('your_cloudinary')
  );
};

// ── Fallback Local Disk Storage ─────────────────────────────────────────────
const createLocalStorage = (subfolder = '') => multer.diskStorage({
  destination: (req, file, cb) => cb(null, localUploadsDir),
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

// Images are often a different format inside than their name says
// (e.g. a WebP saved from a website and renamed to .png). Cloudinary checks the
// real contents, so accept the common image formats and store the image in the
// format its file name says.
const IMAGE_SOURCE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'heif', 'avif'];
const imageOptions = (ext, allowedFormats) => {
  const target = ext === 'jpeg' ? 'jpg' : ext;
  const allowed = Array.from(new Set([...(allowedFormats || []), ...IMAGE_SOURCE_FORMATS]))
    .filter((f) => !['pdf', 'doc', 'docx'].includes(f));
  return {
    allowed_formats: allowed,
    ...(IMAGE_SOURCE_FORMATS.includes(target) ? { format: target } : {})
  };
};

// ── Cloudinary Storage Generators ───────────────────────────────────────────
const createCloudinaryStorage = (folderName, allowedFormats = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
      const isPdfOrDoc = ['pdf', 'doc', 'docx'].includes(ext);

      return {
        folder: folderName,
        // Documents are stored privately: they can only be opened through
        // LegalLink's short-lived links (see services/fileAccess.js).
        // Profile photos stay public.
        type: folderName.includes('avatars') ? 'upload' : 'authenticated',
        resource_type: isPdfOrDoc ? 'raw' : 'auto',
        ...(isPdfOrDoc ? {} : imageOptions(ext, allowedFormats)),
        public_id: `${Date.now()}-${path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_')}${isPdfOrDoc ? '.' + ext : ''}`
      };
    }
  });
};

// ── Smart Multer Factory (Cloudinary with Local Fallback) ────────────────────
const createUploader = ({ folder, allowedFormats, fileSize = 10 * 1024 * 1024 }) => {
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedFormats.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format .${ext}. Allowed formats: ${allowedFormats.join(', ')}`));
    }
  };

  const getStorage = () => {
    configureCloudinary();
    if (isCloudinaryConfigured()) {
      return createCloudinaryStorage(folder, allowedFormats);
    }
    console.warn(`📁 [Storage Info] Cloudinary unconfigured/placeholder. Uploading '${folder}' to local uploads/`);
    return createLocalStorage(folder);
  };

  return multer({
    storage: getStorage(),
    limits: { fileSize },
    fileFilter
  });
};

// ── Pre-configured Upload Middlewares ────────────────────────────────────────

// 1. Profile Photos / Avatars
const uploadAvatar = createUploader({
  folder: 'legallink/avatars',
  allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  fileSize: 5 * 1024 * 1024
});

// 2. Official Legal Documents (Bar Council cards, NGO certificates)
const uploadLegalDoc = createUploader({
  folder: 'legallink/documents',
  allowedFormats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
  fileSize: 10 * 1024 * 1024
});

// 3. Case Evidence Attachments (FIRs, affidavits, contracts)
const uploadCaseDoc = createUploader({
  folder: 'legallink/case_evidence',
  allowedFormats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
  fileSize: 15 * 1024 * 1024
});

// 4. Combined Lawyer Signup (photo + officialDocument)
const getLawyerSignupUploader = () => {
  configureCloudinary();
  const storage = isCloudinaryConfigured()
    ? new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
          const isDoc = file.fieldname === 'officialDocument';
          const folder = isDoc ? 'legallink/documents' : 'legallink/avatars';
          const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
          const isRaw = ['pdf', 'doc', 'docx'].includes(ext);

          return {
            folder: folder,
            // Bar Council documents are private; the profile photo is public
            type: isDoc ? 'authenticated' : 'upload',
            resource_type: isRaw ? 'raw' : 'auto',
            ...(isRaw ? {} : imageOptions(ext, isDoc ? ['jpg', 'jpeg', 'png'] : ['jpg', 'jpeg', 'png', 'webp'])),
            public_id: `${Date.now()}-${path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_')}${isRaw ? '.' + ext : ''}`
          };
        }
      })
    : createLocalStorage();

  // Only photos for "photo" and documents for "officialDocument"; anything
  // else (for example .html or .exe files) is refused.
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace('.', '');
    const allowed = file.fieldname === 'photo' ? ['jpg', 'jpeg', 'png', 'webp'] : ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Unsupported file format .${ext || '?'}. Allowed: ${allowed.join(', ')}`));
  };

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter
  });
};

// ── URL Normalizer Helper ───────────────────────────────────────────────────
/**
 * Extracts normalized file URL from multer file object.
 * Returns Cloudinary HTTPS URL or local /uploads/... path.
 */
const getUploadedFileUrl = (file) => {
  if (!file) return '';
  // Cloudinary populates file.path or file.secure_url
  if (file.path && (file.path.startsWith('http://') || file.path.startsWith('https://'))) {
    return file.path;
  }
  if (file.secure_url) {
    return file.secure_url;
  }
  // Local storage populates file.filename
  if (file.filename) {
    return `/uploads/${file.filename}`;
  }
  return file.path || '';
};

// ── Cloudinary Asset Deletion Utility ───────────────────────────────────────
const deleteFromCloudinary = async (fileUrlOrPublicId, resourceType = 'image') => {
  if (!fileUrlOrPublicId) return;
  if (!isCloudinaryConfigured()) return;

  try {
    let publicId = fileUrlOrPublicId;
    if (fileUrlOrPublicId.startsWith('http://') || fileUrlOrPublicId.startsWith('https://')) {
      // Extract public_id from Cloudinary URL (e.g. legallink/avatars/172000000_photo)
      const matches = fileUrlOrPublicId.match(/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
      if (matches && matches[1]) {
        publicId = matches[1];
      }
    }

    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`🗑️ [Cloudinary Destroy] Deleted asset ${publicId}:`, result);
    return result;
  } catch (error) {
    console.warn(`⚠️ [Cloudinary Destroy Failed] For ${fileUrlOrPublicId}:`, error.message);
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadAvatar,
  uploadLegalDoc,
  uploadCaseDoc,
  getLawyerSignupUploader,
  getUploadedFileUrl,
  deleteFromCloudinary
};