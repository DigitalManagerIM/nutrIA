import multer from 'multer';
import path from 'path';

// Always use memory storage — storeFile() in firebase.ts handles persistence
const storage = multer.memoryStorage();

const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);

export const upload = multer({
  storage,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/i;
    if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  },
});
