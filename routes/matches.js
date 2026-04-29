import { Router } from 'express';
import Match from '../models/Match.js';
import Sticker from '../models/Sticker.js';
import { protect } from '../middleware/auth.js';
import { io } from '../index.js';

const router = Router();

// GET /api/matches — mis matches (pendientes, aceptados)
router.get('/', protect, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {
      $or: [{ userA: req.user._id }, { userB: req.user._id }],
    };
    if (status) filter.status = status;

    const matches = await Match.find(filter)
      .populate('userA', 'name university averageRating avatar')
      .populate('userB', 'name university averageRating avatar')
      .populate('stickerOfferedByA')
      .populate('stickerOfferedByB')
      .sort({ createdAt: -1 });

    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/matches/:id/accept — aceptar match
router.patch('/:id/accept', protect, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match no encontrado' });

    const isUserA = match.userA.toString() === req.user._id.toString();
    const isUserB = match.userB.toString() === req.user._id.toString();

    if (!isUserA && !isUserB) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    if (isUserA) match.acceptedByA = true;
    if (isUserB) match.acceptedByB = true;

    if (match.acceptedByA && match.acceptedByB) {
      match.status = 'accepted';

      // Desactivar láminas involucradas
      await Sticker.updateMany(
        { _id: { $in: [match.stickerOfferedByA, match.stickerOfferedByB] } },
        { isActive: false }
      );

      // Notificar a ambos
      io.to(match.userA.toString()).emit('match_accepted', match);
      io.to(match.userB.toString()).emit('match_accepted', match);
    }

    await match.save();
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/matches/:id/complete — marcar intercambio como completado
router.patch('/:id/complete', protect, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match no encontrado' });

    if (match.status !== 'accepted') {
      return res.status(400).json({ message: 'El match debe estar aceptado primero' });
    }

    match.status = 'completed';
    await match.save();

    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/matches/:id/reject
router.patch('/:id/reject', protect, async (req, res) => {
  try {
    const match = await Match.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ userA: req.user._id }, { userB: req.user._id }],
      },
      { status: 'rejected' },
      { new: true }
    );
    if (!match) return res.status(404).json({ message: 'Match no encontrado' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
