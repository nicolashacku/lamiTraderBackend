import { Router } from 'express';
import jwt  from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { emitFeedEvent } from '../utils/activityFeed.js';

const router = Router();

// Dominios universitarios colombianos reconocidos
const UNI_DOMAINS = [
  'unal.edu.co','uniandes.edu.co','javeriana.edu.co','urosario.edu.co',
  'udea.edu.co','univalle.edu.co','uis.edu.co','upb.edu.co',
  'eafit.edu.co','uexternado.edu.co','unisabana.edu.co','udistrital.edu.co',
  // Permitir cualquier .edu.co o .edu para no bloquear otras universidades
];

const isUniEmail = (email) => {
  const domain = email.split('@')[1] || '';
  return domain.endsWith('.edu.co') || domain.endsWith('.edu');
};

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, university, bio } = req.body;
    if (!name || !email || !password || !university)
      return res.status(400).json({ message: 'Todos los campos son requeridos' });

    if (!isUniEmail(email))
      return res.status(400).json({ message: 'Debes usar tu correo universitario (.edu.co o .edu)' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'El email ya está registrado' });

    const user  = await User.create({ name, email, password, university, bio });
    const token = signToken(user._id);

    // Feed event
    emitFeedEvent('user_joined', { actors: [user._id], meta: { university } }).catch(console.error);

    res.status(201).json({ token, user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email y contraseña requeridos' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Credenciales inválidas' });

    res.json({ token: signToken(user._id), user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => res.json(req.user));

// POST /api/auth/rate/:userId
router.post('/rate/:userId', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ message: 'Rating debe ser entre 1 y 5' });
    if (req.params.userId === req.user._id.toString())
      return res.status(400).json({ message: 'No puedes calificarte a ti mismo' });

    const userToRate = await User.findById(req.params.userId);
    if (!userToRate) return res.status(404).json({ message: 'Usuario no encontrado' });

    const idx = userToRate.ratings.findIndex(
      (r) => r.reviewer.toString() === req.user._id.toString()
    );
    if (idx >= 0) {
      userToRate.ratings[idx].rating  = rating;
      userToRate.ratings[idx].comment = comment || '';
    } else {
      userToRate.ratings.push({ reviewer: req.user._id, rating, comment });
    }

    userToRate.recalculateRating();
    await userToRate.save();
    res.json({ averageRating: userToRate.averageRating, totalRatings: userToRate.totalRatings });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/auth/profile/:userId
router.get('/profile/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password -ratings');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
