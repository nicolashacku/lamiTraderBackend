import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, university, bio } = req.body;

    if (!name || !email || !password || !university) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }

    const user = await User.create({ name, email, password, university, bio });
    const token = signToken(user._id);

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña requeridos' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

// POST /api/auth/rate/:userId — calificar a un usuario
router.post('/rate/:userId', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating debe ser entre 1 y 5' });
    }

    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'No puedes calificarte a ti mismo' });
    }

    const userToRate = await User.findById(req.params.userId);
    if (!userToRate) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Actualizar o insertar rating del mismo reviewer
    const existingIdx = userToRate.ratings.findIndex(
      (r) => r.reviewer.toString() === req.user._id.toString()
    );

    if (existingIdx >= 0) {
      userToRate.ratings[existingIdx].rating = rating;
      userToRate.ratings[existingIdx].comment = comment || '';
    } else {
      userToRate.ratings.push({ reviewer: req.user._id, rating, comment });
    }

    userToRate.recalculateRating();
    await userToRate.save();

    res.json({
      averageRating: userToRate.averageRating,
      totalRatings: userToRate.totalRatings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/profile/:userId
router.get('/profile/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password -ratings');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
