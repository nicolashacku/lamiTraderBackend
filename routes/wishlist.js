import { Router } from 'express';
import Wishlist from '../models/Wishlist.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/wishlist
router.get('/', protect, async (req, res) => {
  try {
    const items = await Wishlist.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/wishlist
router.post('/', protect, async (req, res) => {
  try {
    const number     = req.body.number?.toString().trim();
    const playerName = req.body.playerName?.trim() || '';
    const team       = req.body.team?.trim() || '';

    if (!number) return res.status(400).json({ message: 'El número es requerido' });

    // Verificar si ya existe antes de hacer upsert para dar mensaje claro
    const existing = await Wishlist.findOne({ owner: req.user._id, number });
    if (existing) {
      return res.status(409).json({ message: `La lámina #${number} ya está en tu wishlist` });
    }

    const item = await Wishlist.create({
      owner: req.user._id,
      number,
      playerName,
      team,
      notified: false,
    });
    res.status(201).json(item);
  } catch (err) {
    // Clave duplicada por race condition
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Esa lámina ya está en tu wishlist' });
    }
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/wishlist/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Wishlist.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    res.json({ message: 'Eliminado de wishlist' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
