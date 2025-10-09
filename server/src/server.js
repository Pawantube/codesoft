// server/src/server.js
import dotenv from 'dotenv';
dotenv.config();
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
import interestRoutes from './routes/interestRoutes.js';
import codingSessionRoutes from './routes/codingSessionRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import postRoutes from './routes/postRoutes.js';
import screeningRoutes from './routes/screeningRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import { initSocket } from './socket.js';
console.log(process.env.cloudinary_url)
// ESM dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve uploads dir (supports server/uploads and <repo>/uploads)
const candidates = [
  path.resolve(__dirname, '../uploads'),
  path.resolve(__dirname, '../../uploads'),
];
let UPLOADS_DIR = candidates.find((p) => fs.existsSync(p));
if (!UPLOADS_DIR) {
  UPLOADS_DIR = path.resolve(__dirname, '../uploads');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

await connectDB();
console.log(process.env.CLOUDINARY_CLOUD_NAME);
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
// Support multiple client origins in production (comma-separated)
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// socket.io
const io = initSocket(server, { corsOrigin: CLIENT_URLS });
app.use((req, _res, next) => { req.io = io; next(); });

// security + logs
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));

// CORS
app.use(cors({ origin: CLIENT_URLS, credentials: true }));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// --- Fallback for stale extension (mp4 ↔ webm): redirect to actual file if id matches
app.get('/uploads/videos/:filename', (req, res, next) => {
  const requested = req.params.filename;           // e.g. 3078...96c.mp4
  const full = path.join(VIDEOS_DIR, requested);
  fs.stat(full, (err, st) => {
    if (!err && st.isFile()) return next();        // static will serve
    const id = requested.replace(/\.[^/.]+$/, ''); // strip ext
    fs.readdir(VIDEOS_DIR, (e2, files = []) => {
      if (e2) return next();
      const found = files.find((f) => f.startsWith(id + '.'));
      if (found) return res.redirect(302, `/uploads/videos/${found}`);
      return next();                               // let static 404
    });
  });
});

// PUBLIC static: /uploads (once, with headers)
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders(res) {
    // Static assets don't need credentials; allow any origin for videos/images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
  },
}));

// rate limit
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

// routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/coding-sessions', codingSessionRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/interview', interviewRoutes);

// chat routes AFTER io attach
import chatRoutes from './routes/chatRoutes.js';
app.use('/api/chat', chatRoutes);

// errors
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving uploads from: ${UPLOADS_DIR}`);
});
