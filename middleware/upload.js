import multer from 'multer';
import path from 'path';
import { mkdirSync } from 'fs';

// Crear carpeta uploads si no existe
mkdirSync('./uploads', { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, './uploads'),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase())
           && allowed.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Solo se permiten imágenes JPG, PNG o WebP'));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB máx
});
