// server/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import feedRoutes from './routes/feedRoutes.js';
import codingSessionRoutes from './routes/codingSessionRoutes.js';
// ✅ keep exactly ONE import of initSocket
import { initSocket } from './socket.js';

// --- ESM dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Resolve uploads directory robustly ---
const candidates = [
  path.resolve(__dirname, '../uploads'),          // server/uploads
  path.resolve(__dirname, '../../uploads'),       // <repo>/uploads
  path.resolve(__dirname, '../public/uploads'),   // server/public/uploads
  path.resolve(__dirname, '../../public/uploads'),// <repo>/public/uploads
  path.resolve(process.cwd(), 'uploads'),         // cwd/uploads
  path.resolve(process.cwd(), 'public/uploads'),  // cwd/public/uploads
];
let UPLOADS_DIR = candidates.find((p) => fs.existsSync(p));
if (!UPLOADS_DIR) {
  // default to server/uploads
  UPLOADS_DIR = path.resolve(__dirname, '../uploads');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// Make sure subfolders exist (common pattern: uploads/videos, uploads/images)
fs.mkdirSync(path.join(UPLOADS_DIR, 'videos'), { recursive: true });

await connectDB();

const app = express();
const server = http.createServer(app); // needed for socket.io

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// init socket.io and expose on req
const io = initSocket(server, { corsOrigin: CLIENT_URL });
app.use((req, _res, next) => { req.io = io; next(); });

// security + logging
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(morgan('dev'));

// CORS
app.use(cors({ origin: CLIENT_URL, credentials: true }));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// 🔓 PUBLIC static: /uploads  (mounted ONCE, before protected routes)
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    setHeaders(res) {
      res.setHeader('Access-Control-Allow-Origin', CLIENT_URL);
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Accept-Ranges', 'bytes'); // helps Chrome seek
    },
  })
);

// rate limiter
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

// health + routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/coding-sessions', codingSessionRoutes);

// mount chat routes AFTER io middleware is attached
import chatRoutes from './routes/chatRoutes.js';
app.use('/api/chat', chatRoutes);

// not found / error handlers
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving uploads from: ${UPLOADS_DIR}`);
});
