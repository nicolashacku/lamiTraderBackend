import { Router } from 'express';
import Sticker from '../models/Sticker.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { findMatches } from '../utils/matchEngine.js';

const router = Router();

/**
 * GET /api/stickers
 *
 * Query params opcionales:
 *  - type        "have" | "want"
 *  - university  nombre (búsqueda parcial, case-insensitive)
 *  - category    "jugador" | "escudo" | "especial" | "estadio" | "leyenda"
 *  - number      número exacto de la lámina
 *  - search      texto libre (jugador o equipo)
 *  - page        (default: 1)
 *  - limit       (default: 20)
 */
router.get('/', async (req, res) => {
  try {
    const { type, university, category, number, search, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };

    if (type && ['have', 'want'].includes(type)) filter.type = type;

    if (university) filter.university = { $regex: university, $options: 'i' };

    if (category && ['jugador', 'escudo', 'especial', 'estadio', 'leyenda'].includes(category)) {
      filter.category = category;
    }

    if (number) filter.number = number.trim();

    if (search) {
      filter.$or = [
        { playerName: { $regex: search, $options: 'i' } },
        { team:       { $regex: search, $options: 'i' } },
        { section:    { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Sticker.countDocuments(filter);

    const stickers = await Sticker.find(filter)
      .populate('owner', 'name university averageRating totalRatings avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      stickers,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stickers/mine
router.get('/mine', protect, async (req, res) => {
  try {
    const stickers = await Sticker.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(stickers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stickers/:id
router.get('/:id', async (req, res) => {
  try {
    const sticker = await Sticker.findById(req.params.id).populate(
      'owner', 'name university averageRating totalRatings avatar bio'
    );
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });
    res.json(sticker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/stickers
 * Acepta multipart/form-data (con imagen adjunta) o application/json (sin imagen).
 * multer pone el archivo en req.file y los campos de texto en req.body.
 */
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { number, playerName, team, section, category, type, notes } = req.body;

    if (!number || !playerName || !team || !type) {
      return res.status(400).json({ message: 'Número, jugador, equipo y tipo son requeridos' });
    }

    // Si se subió archivo usamos su ruta; si no, string vacío
    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : '';

    const sticker = await Sticker.create({
      owner:      req.user._id,
      university: req.user.university,
      number,
      playerName,
      team,
      section,
      image:    imageUrl,
      category: category || 'jugador',
      type,
      notes,
    });

    findMatches(sticker).catch(console.error);
    res.status(201).json(sticker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/stickers/:id
router.patch('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const sticker = await Sticker.findOne({ _id: req.params.id, owner: req.user._id });
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });

    const allowed = ['notes', 'isActive', 'category'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) sticker[field] = req.body[field];
    });

    if (req.file) sticker.image = `/uploads/${req.file.filename}`;

    await sticker.save();
    res.json(sticker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/stickers/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const sticker = await Sticker.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });
    res.json({ message: 'Lámina eliminada' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
