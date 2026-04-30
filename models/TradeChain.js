import mongoose from 'mongoose';

/**
 * TradeChain — intercambio en cadena entre N usuarios.
 * Cada eslabón: userFrom entrega stickerFrom a userTo.
 *
 * Estado del chain:
 *  pending   → detectado, esperando aceptación de todos
 *  active    → todos aceptaron, pendiente de ejecución física
 *  completed → cadena ejecutada (QR confirmados)
 *  cancelled → algún participante rechazó
 */
const linkSchema = new mongoose.Schema({
  userFrom:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  userTo:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  sticker:     { type: mongoose.Schema.Types.ObjectId, ref: 'Sticker', required: true },
  accepted:    { type: Boolean, default: false },
  confirmedQR: { type: Boolean, default: false },
});

const tradeChainSchema = new mongoose.Schema(
  {
    links:       [linkSchema],
    status:      { type: String, enum: ['pending','active','completed','cancelled'], default: 'pending' },
    participants:[ { type: mongoose.Schema.Types.ObjectId, ref: 'User' } ],
  },
  { timestamps: true }
);

export default mongoose.model('TradeChain', tradeChainSchema);
