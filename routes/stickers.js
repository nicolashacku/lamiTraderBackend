import { Router } from 'express';
import Sticker from '../models/Sticker.js';
import { protect } from '../middleware/auth.js';
import { findMatches } from '../utils/matchEngine.js';

const router = Router();

/**
 * GET /api/stickers
 *
 * Query params opcionales:
 *  - type        "have" | "want"
 *  - university  nombre de universidad (búsqueda parcial, case-insensitive)
 *  - rarity      "common" | "rare" | "legendary"
 *  - number      número exacto de la lámina
 *  - search      texto libre (nombre jugador o equipo)
 *  - page        número de página (default: 1)
 *  - limit       resultados por página (default: 20)
 */
router.get('/', async (req, res) => {
  try {
    const { type, university, rarity, number, search, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };

    if (type && ['have', 'want'].includes(type)) {
      filter.type = type;
    }

    if (university) {
      filter.university = { $regex: university, $options: 'i' };
    }

    if (rarity && ['common', 'rare', 'legendary'].includes(rarity)) {
      filter.rarity = rarity;
    }

    if (number) {
      filter.number = number.trim();
    }

    if (search) {
      filter.$or = [
        { playerName: { $regex: search, $options: 'i' } },
        { team: { $regex: search, $options: 'i' } },
        { section: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
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
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stickers/mine — láminas del usuario autenticado
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
      'owner',
      'name university averageRating totalRatings avatar bio'
    );
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });
    res.json(sticker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/stickers — publicar nueva lámina
router.post('/', protect, async (req, res) => {
  try {
    const { number, playerName, team, section, image, rarity, type, notes } = req.body;

    if (!number || !playerName || !team || !type) {
      return res.status(400).json({ message: 'Número, jugador, equipo y tipo son requeridos' });
    }

    const sticker = await Sticker.create({
      owner: req.user._id,
      university: req.user.university,
      number,
      playerName,
      team,
      section,
      image,
      rarity: rarity || 'common',
      type,
      notes,
    });

    // Disparar motor de matches en background (no bloquear respuesta)
    findMatches(sticker).catch(console.error);

    res.status(201).json(sticker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/stickers/:id — actualizar lámina propia
router.patch('/:id', protect, async (req, res) => {
  try {
    const sticker = await Sticker.findOne({ _id: req.params.id, owner: req.user._id });
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });

    const allowed = ['notes', 'isActive', 'image', 'rarity'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) sticker[field] = req.body[field];
    });

    await sticker.save();
    res.json(sticker);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/stickers/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const sticker = await Sticker.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });
    res.json({ message: 'Lámina eliminada' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
