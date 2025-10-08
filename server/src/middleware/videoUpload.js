import multer from 'multer';
import mime from 'mime-types';
// Memory storage so we can stream to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (file.mimetype?.startsWith('video/')) return cb(null, true);
  cb(new Error('Only video files are allowed'), false);
};

export const uploadVideoMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 },
}).single('video');
