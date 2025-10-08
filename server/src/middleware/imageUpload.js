import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (file.mimetype?.startsWith('image/')) return cb(null, true);
  cb(new Error('Only image files are allowed'), false);
};

export const uploadImageMemory = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('image');
