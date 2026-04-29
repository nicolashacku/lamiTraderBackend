import { Router } from 'express';
import Conversation from '../models/Conversation.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/conversations — todas mis conversaciones
router.get('/', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name university avatar averageRating')
      .populate('match')
      .sort({ lastMessageAt: -1 })
      .select('-messages'); // no traer todos los mensajes en el listado

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/conversations/:id — conversación con historial
router.get('/:id', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    })
      .populate('participants', 'name university avatar averageRating')
      .populate({
        path: 'messages.sender',
        select: 'name avatar',
      });

    if (!conversation) return res.status(404).json({ message: 'Conversación no encontrada' });

    // Marcar mensajes como leídos
    conversation.messages.forEach((msg) => {
      if (msg.sender._id?.toString() !== req.user._id.toString()) {
        msg.read = true;
      }
    });
    await conversation.save();

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/conversations — iniciar o recuperar conversación con otro usuario
router.post('/', protect, async (req, res) => {
  try {
    const { otherUserId, matchId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({ message: 'otherUserId es requerido' });
    }

    // Buscar conversación existente entre ambos usuarios
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, otherUserId], $size: 2 },
    }).populate('participants', 'name university avatar averageRating');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, otherUserId],
        match: matchId || null,
        messages: [],
      });
      conversation = await conversation.populate(
        'participants',
        'name university avatar averageRating'
      );
    }

    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
