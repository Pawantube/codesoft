// server/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import http from 'http';

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

await connectDB();

const app = express();
const server = http.createServer(app); // needed for socket.io

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// init socket.io and expose on req
const io = initSocket(server, { corsOrigin: CLIENT_URL });
app.use((req, _res, next) => { req.io = io; next(); });

app.use(helmet());
app.use(morgan('dev'));
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve('uploads')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

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

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


