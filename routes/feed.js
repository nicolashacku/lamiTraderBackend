import { Router } from 'express';
import ActivityFeed from '../models/ActivityFeed.js';
import Sticker     from '../models/Sticker.js';
import User        from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/feed — últimos N eventos del feed global
router.get('/', protect, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100);
    const events = await ActivityFeed.find()
      .populate('actors', 'name university avatar')
      .populate('sticker', 'playerName number team image category')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(events);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/feed/map — estadísticas por universidad para el mapa
router.get('/map', protect, async (req, res) => {
  try {
    // Agregación: universidades con más actividad
    const uniStats = await User.aggregate([
      {
        $lookup: {
          from: 'stickers', localField: '_id', foreignField: 'owner', as: 'stickers',
        },
      },
      {
        $project: {
          university: 1,
          name: 1,
          totalStickers: { $size: '$stickers' },
          haveCount: {
            $size: { $filter: { input: '$stickers', as: 's', cond: { $eq: ['$$s.type','have'] } } },
          },
          wantCount: {
            $size: { $filter: { input: '$stickers', as: 's', cond: { $eq: ['$$s.type','want'] } } },
          },
        },
      },
      { $group: {
          _id: '$university',
          users: { $sum: 1 },
          totalStickers: { $sum: '$totalStickers' },
          haveCount: { $sum: '$haveCount' },
          wantCount: { $sum: '$wantCount' },
        },
      },
      { $sort: { totalStickers: -1 } },
    ]);

    // Trades completados por universidad (de matches)
    const completedTrades = await ActivityFeed.aggregate([
      { $match: { type: 'trade_completed' } },
      { $unwind: '$actors' },
      { $lookup: { from: 'users', localField: 'actors', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $group: { _id: '$user.university', trades: { $sum: 1 } } },
    ]);

    const tradeMap = {};
    completedTrades.forEach((t) => { tradeMap[t._id] = t.trades; });

    const result = uniStats.map((u) => ({
      university:    u._id,
      users:         u.users,
      totalStickers: u.totalStickers,
      haveCount:     u.haveCount,
      wantCount:     u.wantCount,
      tradesCompleted: tradeMap[u._id] || 0,
      activityScore: u.totalStickers * 2 + (tradeMap[u._id] || 0) * 5,
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/feed/album — álbum grupal por universidad
router.get('/album/:university', protect, async (req, res) => {
  try {
    const uni = decodeURIComponent(req.params.university);

    // Todos los números únicos que tienen usuarios de esa universidad
    const haveNumbers = await Sticker.distinct('number', {
      university: uni, type: 'have', isActive: true,
    });
    const wantNumbers = await Sticker.distinct('number', {
      university: uni, type: 'want',
    });

    // Total de láminas del álbum (estimado del máximo número + sección)
    const totalAlbum = 670; // álbum Mundial 2026

    const coverage = Math.min(100, Math.round((haveNumbers.length / totalAlbum) * 100));

    res.json({
      university:   uni,
      totalAlbum,
      haveCount:    haveNumbers.length,
      wantCount:    wantNumbers.length,
      coverage,
      haveNumbers:  haveNumbers.sort(),
      wantNumbers:  wantNumbers.sort(),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
