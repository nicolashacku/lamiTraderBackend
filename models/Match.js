import mongoose from 'mongoose';

/**
 * Un Match existe cuando:
 *  - userA tiene la lámina que userB busca (stickerA → wantedByB)
 *  - userB tiene la lámina que userA busca (stickerB → wantedByA)
 *
 * Estado:
 *  - pending   → detectado automáticamente, aún sin acción
 *  - accepted  → ambos aceptaron
 *  - rejected  → alguno rechazó
 *  - completed → intercambio realizado
 */
const STATUS = ['pending', 'accepted', 'rejected', 'completed'];

const matchSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Lámina que userA ofrece (y userB busca)
    stickerOfferedByA: { type: mongoose.Schema.Types.ObjectId, ref: 'Sticker', required: true },
    // Lámina que userB ofrece (y userA busca)
    stickerOfferedByB: { type: mongoose.Schema.Types.ObjectId, ref: 'Sticker', required: true },

    status: { type: String, enum: STATUS, default: 'pending' },

    // Aceptación individual
    acceptedByA: { type: Boolean, default: false },
    acceptedByB: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Evitar duplicados de matches
matchSchema.index(
  { userA: 1, userB: 1, stickerOfferedByA: 1, stickerOfferedByB: 1 },
  { unique: true }
);

export default mongoose.model('Match', matchSchema);
