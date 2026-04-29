// 1. CARGAR DOTENV AL PRINCIPIO DE TODO
import * as dotenv from 'dotenv';
dotenv.config(); 

// 2. LUEGO EL RESTO DE LAS IMPORTACIONES
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

// Importaciones de tus archivos
import authRoutes from './routes/auth.js';
import stickerRoutes from './routes/stickers.js';
import matchRoutes from './routes/matches.js';
import conversationRoutes from './routes/conversations.js';
import { registerChatHandlers } from './socket/chatHandler.js';

const app = express();
const httpServer = createServer(app);

// DEBUG: Agrega esta línea para ver si realmente se está cargando
console.log('🔍 URI de Mongo:', process.env.MONGO_URI ? 'Detectada (Ok)' : 'No detectada (Undefined)');

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Routes ... (Tus rutas se mantienen igual)
app.use('/api/auth', authRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/conversations', conversationRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Socket.io handlers ... (Se mantienen igual)
io.on('connection', (socket) => {
  registerChatHandlers(io, socket);
});

// MongoDB connection
// USAMOS UNA VALIDACIÓN ANTES DE CONECTAR
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('❌ ERROR: La variable MONGO_URI no está definida en el archivo .env');
  process.exit(1);
}

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

export { io };