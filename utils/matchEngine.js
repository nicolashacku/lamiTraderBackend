/**
 * matchEngine.js — detección de matches bilaterales Y cadenas de intercambio.
 */
import Sticker     from '../models/Sticker.js';
import Match       from '../models/Match.js';
import Wishlist    from '../models/Wishlist.js';
import TradeChain  from '../models/TradeChain.js';
import { io }      from '../index.js';
import { emitFeedEvent } from './activityFeed.js';

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
export const findMatches = async (newSticker) => {
  try {
    const { owner: ownerId, type } = newSticker;
    if (type === 'have') {
      await findMatchesForHave(newSticker, ownerId);
      await notifyWishlist(newSticker);
    } else {
      await findMatchesForWant(newSticker, ownerId);
    }
    // Intentar construir cadenas después de cada nueva lámina
    await findTradeChains(ownerId);
  } catch (err) {
    console.error('❌ matchEngine error:', err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MATCHES BILATERALES
// ─────────────────────────────────────────────────────────────────────────────
const findMatchesForHave = async (haveSticker, ownerId) => {
  const wantingStickers = await Sticker.find({
    number: haveSticker.number, type: 'want', isActive: true, owner: { $ne: ownerId },
  });
  for (const wantSticker of wantingStickers) {
    const otherUserId   = wantSticker.owner;
    const myWantNumbers = (await Sticker.find({ owner: ownerId, type: 'want', isActive: true }))
                            .map((s) => s.number);
    const counterOffer  = await Sticker.findOne({
      owner: otherUserId, type: 'have', number: { $in: myWantNumbers }, isActive: true,
    });
    if (counterOffer) {
      await createMatch({
        userA: ownerId, userB: otherUserId,
        stickerOfferedByA: haveSticker._id, stickerOfferedByB: counterOffer._id,
      });
    }
  }
};

const findMatchesForWant = async (wantSticker, ownerId) => {
  const havingStickers = await Sticker.find({
    number: wantSticker.number, type: 'have', isActive: true, owner: { $ne: ownerId },
  });
  for (const haveSticker of havingStickers) {
    const otherUserId    = haveSticker.owner;
    const otherWantNumbers = (await Sticker.find({ owner: otherUserId, type: 'want', isActive: true }))
                               .map((s) => s.number);
    const counterOffer   = await Sticker.findOne({
      owner: ownerId, type: 'have', number: { $in: otherWantNumbers }, isActive: true,
    });
    if (counterOffer) {
      await createMatch({
        userA: otherUserId, userB: ownerId,
        stickerOfferedByA: haveSticker._id, stickerOfferedByB: wantSticker._id,
      });
    }
  }
};

const createMatch = async ({ userA, userB, stickerOfferedByA, stickerOfferedByB }) => {
  try {
    const match = await Match.findOneAndUpdate(
      { userA, userB, stickerOfferedByA, stickerOfferedByB },
      { $setOnInsert: { userA, userB, stickerOfferedByA, stickerOfferedByB, status: 'pending' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('stickerOfferedByA stickerOfferedByB userA userB');

    io.to(userA.toString()).emit('new_match', match);
    io.to(userB.toString()).emit('new_match', match);
    await emitFeedEvent('match_created', {
      actors: [userA, userB],
      sticker: stickerOfferedByA,
      meta: { stickerB: stickerOfferedByB },
    });
    return match;
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// WISHLIST — avisar cuando aparece una lámina que alguien necesita
// ─────────────────────────────────────────────────────────────────────────────
const notifyWishlist = async (haveSticker) => {
  const normalizedNumber = haveSticker.number.toString().trim();

  const wishers = await Wishlist.find({
    number: { $regex: '^\\s*' + normalizedNumber + '\\s*$', $options: 'i' },
    owner:  { $ne: haveSticker.owner },
  }).populate('owner', '_id name');

  console.log('Wishlist notify: lamina #' + normalizedNumber + ' → ' + wishers.length + ' usuario(s)');

  for (const wish of wishers) {
    io.to(wish.owner._id.toString()).emit('wishlist_match', {
      stickerNumber: normalizedNumber,
      stickerId:     haveSticker._id,
      playerName:    haveSticker.playerName,
      team:          haveSticker.team,
      publishedBy:   haveSticker.owner,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CADENAS DE INTERCAMBIO (A→B→C→A o longitudes mayores)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Busca cadenas de 3 participantes:
 *   A tiene X que B quiere,
 *   B tiene Y que C quiere,
 *   C tiene Z que A quiere.
 * Limitamos a cadenas de longitud 3 para mantener la complejidad manejable.
 */
const findTradeChains = async (triggerUserId) => {
  // Recopilar todos los pares HAVE→WANT activos (excluyendo matches ya existentes)
  const haves = await Sticker.find({ type: 'have', isActive: true }).lean();
  const wants = await Sticker.find({ type: 'want', isActive: true }).lean();

  // Índice rápido: number → [userId que lo tiene]
  const haveMap = {};
  for (const s of haves) {
    const key = s.number;
    if (!haveMap[key]) haveMap[key] = [];
    haveMap[key].push({ userId: s.owner.toString(), stickerId: s._id });
  }

  // Para cada usuario A → sus WANT numbers
  const wantsByUser = {};
  for (const s of wants) {
    const uid = s.owner.toString();
    if (!wantsByUser[uid]) wantsByUser[uid] = [];
    wantsByUser[uid].push({ number: s.number, stickerId: s._id });
  }

  // Solo procesamos cadenas que involucren al usuario que acaba de publicar
  const uid = triggerUserId.toString();
  const myHaves = haves.filter((s) => s.owner.toString() === uid);

  for (const aSticker of myHaves) {
    // Usuarios B que quieren lo que A tiene
    const bCandidates = (haveMap[aSticker.number] || []).filter((h) => h.userId !== uid);
    // Espera: B debe TENER aSticker.number; A quiere que B lo tenga en "want"
    // Corrección: B quiere aSticker.number → wantsByUser[B] contiene aSticker.number
    const bUsers = (wants.filter(
      (w) => w.number === aSticker.number && w.owner.toString() !== uid
    )).map((w) => w.owner.toString());

    for (const bId of bUsers) {
      const bHaves  = haves.filter((s) => s.owner.toString() === bId);
      const aWants  = (wantsByUser[uid] || []).map((w) => w.number);

      for (const bSticker of bHaves) {
        // Usuarios C que quieren lo que B tiene
        const cUsers = (wants.filter(
          (w) => w.number === bSticker.number && w.owner.toString() !== uid && w.owner.toString() !== bId
        )).map((w) => w.owner.toString());

        for (const cId of cUsers) {
          const cHaves  = haves.filter((s) => s.owner.toString() === cId);
          // C debe tener algo que A quiere
          const cOffers = cHaves.filter((s) => aWants.includes(s.number));

          for (const cSticker of cOffers) {
            // ¡Cadena encontrada! A→B→C→A
            await createChain([
              { userFrom: uid, userTo: bId,  sticker: aSticker._id  },
              { userFrom: bId, userTo: cId,  sticker: bSticker._id  },
              { userFrom: cId, userTo: uid,  sticker: cSticker._id  },
            ], [uid, bId, cId]);
          }
        }
      }
    }
  }
};

const createChain = async (links, participantIds) => {
  // Evitar crear cadenas duplicadas (mismo conjunto de participantes + stickers)
  const stickerIds = links.map((l) => l.sticker.toString()).sort().join(',');
  const existing   = await TradeChain.findOne({
    'links.sticker': { $all: links.map((l) => l.sticker) },
    status: { $in: ['pending', 'active'] },
  });
  if (existing) return;

  const chain = await TradeChain.create({
    links:        links.map((l) => ({ ...l, accepted: false, confirmedQR: false })),
    participants: participantIds,
    status:       'pending',
  });

  console.log(`🔗 Trade chain creada: ${chain._id} (${participantIds.length} participantes)`);

  // Notificar a cada participante
  for (const uid of participantIds) {
    io.to(uid.toString()).emit('new_chain', chain);
  }

  await emitFeedEvent('chain_completed', {
    actors: participantIds,
    meta:   { chainId: chain._id, length: links.length },
  });
};
