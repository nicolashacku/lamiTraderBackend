import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { upload }  from '../middleware/upload.js';
import {
  getStickers,
  getMyStickers,
  getStickerById,
  createSticker,
  updateSticker,
  deleteSticker,
} from '../controllers/stickerController.js';

const router = Router();

// Públicas (sin token) — listado y detalle
router.get('/',      getStickers);
router.get('/mine',  protect, getMyStickers);
router.get('/:id',   getStickerById);

// Requieren auth + multer en memoria
router.post('/',     protect, upload.single('image'), createSticker);
router.patch('/:id', protect, upload.single('image'), updateSticker);
router.delete('/:id',protect, deleteSticker);

export default router;
