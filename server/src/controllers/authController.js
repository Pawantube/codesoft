import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/User.js';

const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const { password, __v, ...rest } = userDoc.toObject ? userDoc.toObject() : userDoc;
  return rest;
};

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role, companyName } = req.body;
  if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already in use' });

  const user = await User.create({ name, email, password, role, companyName });
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
};

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, __v, ...safe } = user;
  res.json(safe);
};

export const updateMe = async (req, res) => {
  const allowed = [
    'name',
    'companyName',
    'headline',
    'bio',
    'phone',
    'location',
    'skills',
    'interests',
    'avatarUrl',
    'links',
    'resumeUrl',
    'videoTags',
    'videoDuration'
  ];

  const updates = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];

  // Drop empty-string values to avoid unintentionally clearing persisted fields
  for (const k of Object.keys(updates)) {
    if (typeof updates[k] === 'string' && updates[k].trim() === '') delete updates[k];
  }

  if ('skills' in updates) updates.skills = parseList(updates.skills);
  if ('interests' in updates) updates.interests = parseList(updates.interests);
  if ('videoTags' in updates) updates.videoTags = parseList(updates.videoTags);

  if (updates.links && typeof updates.links !== 'object') {
    try {
      updates.links = JSON.parse(updates.links);
    } catch {
      updates.links = {};
    }
  }

  if ('videoDuration' in updates) {
    const duration = Number(updates.videoDuration);
    updates.videoDuration = Number.isFinite(duration) && duration >= 0 ? duration : undefined;
  }

  updates.updatedAt = new Date();

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json(sanitizeUser(user));
};
