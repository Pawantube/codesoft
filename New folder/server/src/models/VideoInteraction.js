import mongoose from 'mongoose';

const videoInteractionSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, enum: ['view', 'like', 'skip'], required: true },
  score: { type: Number, default: 0 },
  watchSeconds: { type: Number, default: 0 },
}, { timestamps: true });

videoInteractionSchema.index({ viewer: 1, candidate: 1 }, { unique: true });

export default mongoose.model('VideoInteraction', videoInteractionSchema);
