import mongoose from 'mongoose';
import Emb from '../services/embeddingsService.js';
import bcrypt from 'bcryptjs';

const linkSchema = new mongoose.Schema({
  linkedin: String,
  github: String,
  website: String,
}, { _id: false });

const metricsSchema = new mongoose.Schema({
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  skips: { type: Number, default: 0 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['employer', 'candidate'], required: true },

  // employer specific
  companyName: String,

  // profile fields
  headline: String,
  bio: String,
  phone: String,
  location: String,
  skills: [String],
  interests: [String],
  avatarUrl: String,
  links: linkSchema,
  resumeUrl: String,

  // video introduction
  videoUrl: String,
  videoThumbnailUrl: String,
  videoStatus: { type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft' },
  videoTags: [String],
  videoDuration: Number,
  videoUpdatedAt: Date,
  videoNotes: String,
  videoMetrics: { type: metricsSchema, default: () => ({}) },
}, { timestamps: true });
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// upsert profile embedding after save when relevant fields change
userSchema.post('save', async function(doc) {
  try {
    if (doc.role === 'candidate') {
      await Emb.upsertProfileEmbedding(doc._id);
    }
  } catch {}
});

export default mongoose.model('User', userSchema);
