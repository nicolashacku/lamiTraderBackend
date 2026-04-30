import mongoose from 'mongoose';

/**
 * Categoría de la lámina (reemplaza "rarity"):
 *  - jugador   → fotografía del jugador
 *  - escudo    → escudo del seleccionado
 *  - especial  → lámina foil / especial
 *  - estadio   → imagen del estadio
 *  - leyenda   → leyenda del fútbol mundial
 */
const CATEGORIES = ['jugador', 'escudo', 'especial', 'estadio', 'leyenda'];
const TYPES = ['have', 'want']; // "tengo" o "busco"

const stickerSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Identificación de la lámina en el álbum
    number: { type: String, required: true, trim: true },
    playerName: { type: String, required: true, trim: true },
    team: { type: String, required: true, trim: true },
    section: { type: String, trim: true },
    image: { type: String, default: '' },

    category: { type: String, enum: CATEGORIES, default: 'jugador' },
    type: { type: String, enum: TYPES, required: true },

    university: { type: String, required: true },

    notes: { type: String, maxlength: 200, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Índices para búsqueda eficiente
stickerSchema.index({ type: 1, university: 1, category: 1, isActive: 1 });
stickerSchema.index({ number: 1, type: 1, isActive: 1 });

export default mongoose.model('Sticker', stickerSchema);
