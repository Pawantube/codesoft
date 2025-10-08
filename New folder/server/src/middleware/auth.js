import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const getBearer = (req) => {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const [scheme, token] = h.split(' ');
  if ((scheme || '').toLowerCase() !== 'bearer') return null;
  return (token || '').trim();
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Accepts a string OR an array of roles
 *   requireRole('employer')
 *   requireRole(['employer','admin'])
 */
export const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
