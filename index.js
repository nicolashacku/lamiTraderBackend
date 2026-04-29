// 1. CARGAR DOTENV AL PRINCIPIO
import * as dotenv from 'dotenv';
dotenv.config(); 

// 2. IMPORTACIONES (Solo usa 'import')
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

// 3. CONFIGURACIÓN DE CORS (CORREGIDA)
// Colocamos el CORS antes de las rutas
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

// DEBUG: Verificación de variables
console.log('🔍 URI de Mongo:', process.env.MONGO_URI ? 'Detectada (Ok)' : 'No detectada (Undefined)');

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://lami-trader-ljl2.vercel.app',
      'http://localhost:5173'
    ],
    methods: ['GET', 'POST'],
  },
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/conversations', conversationRoutes);

// Ruta de Ping para UptimeRobot
app.get('/ping', (_req, res) => res.status(200).send('pong'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Socket.io handlers
io.on('connection', (socket) => {
  registerChatHandlers(io, socket);
});

// MongoDB connection
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('❌ ERROR: La variable MONGO_URI no está definida en Render');
  process.exit(1);
}

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 10000; // Render usa 10000 por defecto
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

export { io };