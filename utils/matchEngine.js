/**
 * matchEngine.js
 *
 * Motor de detección automática de matches.
 * Se dispara cuando un usuario publica una nueva lámina.
 *
 * Lógica:
 * Si userA publica una lámina "HAVE" con número X:
 *   → busca otras láminas "WANT" con número X (de distintos usuarios)
 *   → para cada userB encontrado, verifica si userA tiene alguna lámina
 *     "WANT" que userB ofrezca como "HAVE"
 *   → si hay cruce bidireccional → crear Match
 */

import Sticker from '../models/Sticker.js';
import Match from '../models/Match.js';
import { io } from '../index.js';

/**
 * Busca y crea matches para una lámina recién publicada.
 * @param {Object} newSticker - documento Mongoose de la lámina nueva
 */
export const findMatches = async (newSticker) => {
  try {
    const { owner: ownerId, number, type } = newSticker;

    if (type === 'have') {
      await findMatchesForHave(newSticker, ownerId);
    } else {
      await findMatchesForWant(newSticker, ownerId);
    }
  } catch (err) {
    console.error('❌ matchEngine error:', err);
  }
};

/**
 * Caso 1: se publicó una lámina "HAVE"
 * Busca usuarios que la estén buscando (WANT con mismo número)
 */
const findMatchesForHave = async (haveSticker, ownerId) => {
  // Láminas WANT del mismo número, de otros usuarios activas
  const wantingStickers = await Sticker.find({
    number: haveSticker.number,
    type: 'want',
    isActive: true,
    owner: { $ne: ownerId },
  });

  for (const wantSticker of wantingStickers) {
    const otherUserId = wantSticker.owner;

    // ¿El otro usuario tiene algo que el dueño de haveSticker busca?
    const myWants = await Sticker.find({
      owner: ownerId,
      type: 'want',
      isActive: true,
    });

    const myWantNumbers = myWants.map((s) => s.number);

    // Busca si el otro usuario tiene alguna de esas láminas
    const counterOffer = await Sticker.findOne({
      owner: otherUserId,
      type: 'have',
      number: { $in: myWantNumbers },
      isActive: true,
    });

    if (counterOffer) {
      await createMatch({
        userA: ownerId,
        userB: otherUserId,
        stickerOfferedByA: haveSticker._id,
        stickerOfferedByB: counterOffer._id,
      });
    }
  }
};

/**
 * Caso 2: se publicó una lámina "WANT"
 * Busca usuarios que la tengan (HAVE con mismo número)
 */
const findMatchesForWant = async (wantSticker, ownerId) => {
  const havingStickers = await Sticker.find({
    number: wantSticker.number,
    type: 'have',
    isActive: true,
    owner: { $ne: ownerId },
  });

  for (const haveSticker of havingStickers) {
    const otherUserId = haveSticker.owner;

    // ¿El dueño tiene algo que el otro usuario busca?
    const otherWants = await Sticker.find({
      owner: otherUserId,
      type: 'want',
      isActive: true,
    });

    const otherWantNumbers = otherWants.map((s) => s.number);

    const counterOffer = await Sticker.findOne({
      owner: ownerId,
      type: 'have',
      number: { $in: otherWantNumbers },
      isActive: true,
    });

    if (counterOffer) {
      await createMatch({
        userA: otherUserId,
        userB: ownerId,
        stickerOfferedByA: haveSticker._id,
        stickerOfferedByB: wantSticker._id,
      });
    }
  }
};

/**
 * Crea el documento Match (con upsert para evitar duplicados)
 * y notifica a ambos usuarios vía Socket.io
 */
const createMatch = async ({ userA, userB, stickerOfferedByA, stickerOfferedByB }) => {
  try {
    const match = await Match.findOneAndUpdate(
      { userA, userB, stickerOfferedByA, stickerOfferedByB },
      { $setOnInsert: { userA, userB, stickerOfferedByA, stickerOfferedByB, status: 'pending' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('stickerOfferedByA stickerOfferedByB userA userB');

    console.log(`✅ Match creado/existente: ${match._id}`);

    // Notificar en tiempo real a ambos usuarios
    io.to(userA.toString()).emit('new_match', match);
    io.to(userB.toString()).emit('new_match', match);

    return match;
  } catch (err) {
    // Ignorar error de duplicate key (match ya existe)
    if (err.code !== 11000) throw err;
  }
};
