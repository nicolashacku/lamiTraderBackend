import Conversation from '../models/Conversation.js';

/**
 * Registra todos los eventos de chat para un socket.
 *
 * Eventos del cliente:
 *  - join_user_room    → unirse a la sala personal (userId)
 *  - join_conversation → unirse a la sala de una conversación
 *  - send_message      → enviar mensaje
 *  - typing            → indicador de escritura
 *
 * Eventos que emite el servidor:
 *  - receive_message   → nuevo mensaje en la conversación
 *  - typing            → alguien está escribiendo
 *  - new_match         → match automático detectado (emitido desde matchEngine)
 */
export const registerChatHandlers = (io, socket) => {
  // El cliente se une a su sala personal para recibir notificaciones
  socket.on('join_user_room', (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined personal room`);
  });

  // El cliente se une a la sala de una conversación específica
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conv_${conversationId}`);
    console.log(`💬 Socket joined conversation ${conversationId}`);
  });

  // Enviar mensaje
  socket.on('send_message', async ({ conversationId, senderId, text }) => {
    try {
      if (!text?.trim()) return;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      // Verificar que el sender es participante
      const isParticipant = conversation.participants.some(
        (p) => p.toString() === senderId
      );
      if (!isParticipant) return;

      // Guardar mensaje en MongoDB
      const newMessage = {
        sender: senderId,
        text: text.trim(),
        read: false,
      };
      conversation.messages.push(newMessage);
      conversation.lastMessageAt = new Date();
      await conversation.save();

      // Recuperar el mensaje guardado (con _id generado)
      const savedMessage = conversation.messages[conversation.messages.length - 1];

      // Emitir a todos en la sala de la conversación
      io.to(`conv_${conversationId}`).emit('receive_message', {
        conversationId,
        message: {
          ...savedMessage.toObject(),
          sender: { _id: senderId },
        },
      });
    } catch (err) {
      console.error('❌ send_message error:', err);
    }
  });

  // Indicador de escritura
  socket.on('typing', ({ conversationId, userId, isTyping }) => {
    socket.to(`conv_${conversationId}`).emit('typing', { userId, isTyping });
  });
};
