import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { setupWebSocket } from './websocket/socketHandler.js';
import { query } from './database/db.js';

dotenv.config();

// Run startup migrations
async function runMigrations() {
  try {
    await query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runMigrations();

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Setup WebSocket handlers
setupWebSocket(io);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🎵 BeatConnect Backend Server                           ║
  ║                                                           ║
  ║   Server running on port ${PORT}                            ║
  ║   WebSocket enabled                                       ║
  ║   Frontend URL: ${FRONTEND_URL}                     ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});

export { io };
