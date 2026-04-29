import mongoose from 'mongoose';

/**
 * Rareza de la lámina:
 *  - common   → lámina normal
 *  - rare     → difícil de conseguir
 *  - legendary → casi imposible
 */
const RARITIES = ['common', 'rare', 'legendary'];
const TYPES = ['have', 'want']; // "tengo" o "busco"

const stickerSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Identificación de la lámina en el álbum
    number: { type: String, required: true, trim: true }, // ej. "42", "A3"
    playerName: { type: String, required: true, trim: true },
    team: { type: String, required: true, trim: true },
    section: { type: String, trim: true }, // sección del álbum ej. "Grupo A"
    image: { type: String, default: '' },

    rarity: { type: String, enum: RARITIES, default: 'common' },
    type: { type: String, enum: TYPES, required: true }, // "have" | "want"

    university: { type: String, required: true }, // se copia del usuario al crear

    notes: { type: String, maxlength: 200, default: '' },
    isActive: { type: Boolean, default: true }, // false cuando ya se intercambió
  },
  { timestamps: true }
);

// Índices para búsqueda eficiente
stickerSchema.index({ type: 1, university: 1, rarity: 1, isActive: 1 });
stickerSchema.index({ number: 1, type: 1, isActive: 1 });

export default mongoose.model('Sticker', stickerSchema);
