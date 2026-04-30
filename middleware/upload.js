import multer from 'multer';

/**
 * Multer configurado con memoryStorage.
 * La imagen llega en req.file.buffer — nunca toca el disco.
 * Límite: 4 MB. Tipos: jpg, png, webp.
 */
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (_req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPG, PNG o WebP'), false);
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),   // ← en memoria, sin carpetas locales
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});
