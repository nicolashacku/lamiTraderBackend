import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    // Siempre exactamente dos participantes
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ],

    // Match asociado (opcional — puede haber chat sin match formal)
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },

    messages: [messageSchema],

    // Fecha del último mensaje para ordenar la lista de chats
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Garantizar exactamente 2 participantes
conversationSchema.index({ participants: 1 });

export default mongoose.model('Conversation', conversationSchema);
