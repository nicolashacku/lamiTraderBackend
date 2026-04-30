import mongoose from 'mongoose';

/**
 * ActivityFeed — eventos públicos de la plataforma.
 * Tipos:
 *  match_created     → nuevo match bilateral detectado
 *  trade_completed   → intercambio completado
 *  chain_completed   → cadena de 3+ completada
 *  sticker_published → alguien publicó una lámina rara/legendaria
 *  user_joined       → nuevo usuario se registró
 */
const feedSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['match_created','trade_completed','chain_completed','sticker_published','user_joined'],
      required: true,
    },
    actors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  // usuarios involucrados
    sticker:{ type: mongoose.Schema.Types.ObjectId, ref: 'Sticker', default: null },
    meta:   { type: mongoose.Schema.Types.Mixed, default: {} },        // datos extra flexibles
  },
  { timestamps: true }
);

feedSchema.index({ createdAt: -1 });

export default mongoose.model('ActivityFeed', feedSchema);
