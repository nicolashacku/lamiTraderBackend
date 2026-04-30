import axios    from 'axios';
import FormData from 'form-data';
import Sticker  from '../models/Sticker.js';
import { findMatches } from '../utils/matchEngine.js';

// TODO: mover a .env → IMGBB_KEY=07339b4232e52fe5ca8fc815f62134b0
const IMGBB_KEY = process.env.IMGBB_KEY || '07339b4232e52fe5ca8fc815f62134b0';

/**
 * Convierte un Buffer a Base64 y lo sube a ImgBB.
 * Devuelve la URL permanente o lanza error.
 */
const uploadToImgBB = async (fileBuffer) => {
  const imageBase64 = fileBuffer.toString('base64');

  const form = new FormData();
  form.append('image', imageBase64);

  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
    form,
    { headers: form.getHeaders() }
  );

  const url = response.data.data.url;
  console.log('✅ Imagen subida a ImgBB:', url);
  return url;
};

// ─── GET /api/stickers ───────────────────────────────────────────────────────
export const getStickers = async (req, res) => {
  try {
    const {
      type, university, category, number, search,
      page = 1, limit = 20,
    } = req.query;

    const filter = { isActive: true };
    if (type && ['have','want'].includes(type))           filter.type = type;
    if (university)  filter.university = { $regex: university, $options: 'i' };
    if (category && ['jugador','escudo','especial','estadio','leyenda'].includes(category))
                     filter.category = category;
    if (number)      filter.number = number.trim();
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

    res.json({ stickers, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── GET /api/stickers/mine ──────────────────────────────────────────────────
export const getMyStickers = async (req, res) => {
  try {
    const stickers = await Sticker.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(stickers);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── GET /api/stickers/:id ───────────────────────────────────────────────────
export const getStickerById = async (req, res) => {
  try {
    const sticker = await Sticker.findById(req.params.id)
      .populate('owner', 'name university averageRating totalRatings avatar bio');
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });
    res.json(sticker);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── POST /api/stickers ──────────────────────────────────────────────────────
export const createSticker = async (req, res) => {
  try {
    const { number, playerName, team, section, category, type, notes } = req.body;

    if (!number || !playerName || !team || !type) {
      return res.status(400).json({ message: 'Número, jugador, equipo y tipo son requeridos' });
    }

    // 1. Subir imagen a ImgBB si viene archivo en memoria
    let imageUrl = '';
    if (req.file) {
      try {
        imageUrl = await uploadToImgBB(req.file.buffer);
      } catch (imgErr) {
        console.error('❌ Error ImgBB:', imgErr.response?.data || imgErr.message);
        return res.status(502).json({ message: 'Fallo al subir la imagen a ImgBB. Intenta de nuevo.' });
      }
    }

    // 2. Guardar en MongoDB con la URL permanente
    const sticker = await Sticker.create({
      owner:      req.user._id,
      university: req.user.university,
      number:     number.trim(),
      playerName: playerName.trim(),
      team:       team.trim(),
      section:    section?.trim() || '',
      image:      imageUrl,
      category:   category || 'jugador',
      type,
      notes:      notes?.trim() || '',
    });

    // 3. Disparar motor de matches en background
    findMatches(sticker).catch(console.error);

    res.status(201).json({ success: true, url: imageUrl, sticker });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── PATCH /api/stickers/:id ─────────────────────────────────────────────────
export const updateSticker = async (req, res) => {
  try {
    const sticker = await Sticker.findOne({ _id: req.params.id, owner: req.user._id });
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });

    ['notes', 'isActive', 'category'].forEach((f) => {
      if (req.body[f] !== undefined) sticker[f] = req.body[f];
    });

    if (req.file) {
      try {
        sticker.image = await uploadToImgBB(req.file.buffer);
      } catch (imgErr) {
        console.error('❌ Error ImgBB:', imgErr.response?.data || imgErr.message);
        return res.status(502).json({ message: 'Fallo al subir la imagen a ImgBB.' });
      }
    }

    await sticker.save();
    res.json({ success: true, url: sticker.image, sticker });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── DELETE /api/stickers/:id ────────────────────────────────────────────────
export const deleteSticker = async (req, res) => {
  try {
    const sticker = await Sticker.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!sticker) return res.status(404).json({ message: 'Lámina no encontrada' });
    res.json({ message: 'Lámina eliminada' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
