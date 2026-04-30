import ActivityFeed from '../models/ActivityFeed.js';
import { io } from '../index.js';

/**
 * Crea un evento en el feed y lo emite por socket a todos los clientes.
 */
export const emitFeedEvent = async (type, { actors = [], sticker = null, meta = {} } = {}) => {
  try {
    const event = await ActivityFeed.create({ type, actors, sticker, meta });
    const populated = await event.populate('actors', 'name university');
    if (sticker) await populated.populate('sticker', 'playerName number team');

    io.emit('feed_event', populated);          // broadcast global
    return populated;
  } catch (err) {
    console.error('❌ activityFeed error:', err);
  }
};
