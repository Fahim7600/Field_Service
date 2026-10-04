import multer from 'multer';
import { ApiError } from '../utils/apiError';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(422, 'Only JPG, PNG or WEBP images are allowed'));
    }
    callback(null, true);
  },
});

export const uploadSingleImage = (fieldName: string) => upload.single(fieldName);

export const uploadMultipleImages = (fieldName: string, maxCount: number) => {
  return multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: maxCount,
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(new ApiError(422, 'Only JPG, PNG or WEBP images are allowed'));
      }
      callback(null, true);
    },
  }).array(fieldName, maxCount);
};
