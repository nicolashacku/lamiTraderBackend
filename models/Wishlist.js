import mongoose from 'mongoose';

/**
 * Wishlist — "láminas que me faltan del álbum físico"
 * Una entrada por usuario-número. El motor revisa la wishlist
 * cada vez que alguien publica una lámina HAVE y emite alerta.
 */
const wishlistSchema = new mongoose.Schema(
  {
    owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    number:     { type: String, required: true, trim: true },
    playerName: { type: String, trim: true, default: '' },
    team:       { type: String, trim: true, default: '' },
    notified:   { type: Boolean, default: false }, // ya se emitió alerta
  },
  { timestamps: true }
);

wishlistSchema.index({ owner: 1, number: 1 }, { unique: true });
wishlistSchema.index({ number: 1 });

export default mongoose.model('Wishlist', wishlistSchema);
