import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import qrcode from 'qrcode';
import TradeChain from '../models/TradeChain.js';
import Sticker    from '../models/Sticker.js';
import { protect } from '../middleware/auth.js';
import { emitFeedEvent } from '../utils/activityFeed.js';
import { io } from '../index.js';

const router = Router();

// GET /api/chains — mis cadenas
router.get('/', protect, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { participants: req.user._id };
    if (status) filter.status = status;

    const chains = await TradeChain.find(filter)
      .populate('participants', 'name university averageRating avatar')
      .populate('links.userFrom links.userTo', 'name university')
      .populate('links.sticker', 'playerName number team image category')
      .sort({ createdAt: -1 });

    res.json(chains);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/chains/:id/accept — aceptar mi parte de la cadena
router.patch('/:id/accept', protect, async (req, res) => {
  try {
    const chain = await TradeChain.findOne({
      _id: req.params.id, participants: req.user._id, status: 'pending',
    });
    if (!chain) return res.status(404).json({ message: 'Cadena no encontrada' });

    // Marcar como aceptados los eslabones donde soy userFrom
    chain.links.forEach((link) => {
      if (link.userFrom.toString() === req.user._id.toString()) link.accepted = true;
    });

    // Si todos aceptaron → activar
    if (chain.links.every((l) => l.accepted)) {
      chain.status = 'active';
      chain.participants.forEach((uid) =>
        io.to(uid.toString()).emit('chain_active', { chainId: chain._id })
      );
    }

    await chain.save();
    res.json(chain);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/chains/:id/qr — generar QR para confirmar mi entrega
router.get('/:id/qr', protect, async (req, res) => {
  try {
    const chain = await TradeChain.findOne({
      _id: req.params.id, participants: req.user._id, status: 'active',
    });
    if (!chain) return res.status(404).json({ message: 'Cadena no activa' });

    // Token único por usuario+cadena, lo generamos como hash simple
    const token = `${chain._id}-${req.user._id}-${uuidv4()}`;
    const qrDataURL = await qrcode.toDataURL(
      JSON.stringify({ chainId: chain._id, userId: req.user._id, token }),
      { width: 300, margin: 2 }
    );

    res.json({ qrDataURL, token });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/chains/:id/confirm-qr — escanear QR del otro y confirmar
router.post('/:id/confirm-qr', protect, async (req, res) => {
  try {
    const { scannedUserId } = req.body;
    const chain = await TradeChain.findOne({
      _id: req.params.id, participants: req.user._id, status: 'active',
    });
    if (!chain) return res.status(404).json({ message: 'Cadena no activa' });

    // Marcar el eslabón donde scannedUser entrega a mí (req.user) como confirmedQR
    const myLink = chain.links.find(
      (l) => l.userFrom.toString() === scannedUserId &&
             l.userTo.toString()   === req.user._id.toString()
    );
    if (!myLink) return res.status(400).json({ message: 'Eslabón no encontrado' });
    myLink.confirmedQR = true;

    // Si todos los eslabones están confirmados → completar cadena
    if (chain.links.every((l) => l.confirmedQR)) {
      chain.status = 'completed';
      // Desactivar todas las láminas de la cadena
      const stickerIds = chain.links.map((l) => l.sticker);
      await Sticker.updateMany({ _id: { $in: stickerIds } }, { isActive: false });

      chain.participants.forEach((uid) =>
        io.to(uid.toString()).emit('chain_completed', { chainId: chain._id })
      );
      await emitFeedEvent('chain_completed', {
        actors: chain.participants,
        meta:   { chainId: chain._id, length: chain.links.length },
      });
    }

    await chain.save();
    res.json(chain);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/chains/:id/cancel
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const chain = await TradeChain.findOneAndUpdate(
      { _id: req.params.id, participants: req.user._id, status: { $in: ['pending','active'] } },
      { status: 'cancelled' }, { new: true }
    );
    if (!chain) return res.status(404).json({ message: 'Cadena no encontrada' });
    res.json(chain);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
