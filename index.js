import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import { createServer } from 'http';
import { Server }       from 'socket.io';
import mongoose         from 'mongoose';
import { mkdirSync }    from 'fs';

import authRoutes         from './routes/auth.js';
import stickerRoutes      from './routes/stickers.js';
import matchRoutes        from './routes/matches.js';
import conversationRoutes from './routes/conversations.js';
import wishlistRoutes     from './routes/wishlist.js';
import tradeChainRoutes   from './routes/tradeChains.js';
import feedRoutes         from './routes/feed.js';
import { registerChatHandlers } from './socket/chatHandler.js';

mkdirSync('./uploads', { recursive: true });

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'https://lami-trader-ljl2.vercel.app', methods: ['GET','POST'] },
});
app.use(cors({
  origin: [
    'https://lami-trader-1jl2-b77dzl7ww-nicolashackus-projects.vercel.app',
    'https://lami-trader-ljl2.vercel.app',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth',          authRoutes);
app.use('/api/stickers',      stickerRoutes);
app.use('/api/matches',       matchRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/wishlist',      wishlistRoutes);
app.use('/api/chains',        tradeChainRoutes);
app.use('/api/feed',          feedRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  registerChatHandlers(io, socket);
  socket.on('disconnect', () => console.log(`🔌 Socket disconnected: ${socket.id}`));
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => { console.error('❌ MongoDB connection error:', err); process.exit(1); });

export { io };
