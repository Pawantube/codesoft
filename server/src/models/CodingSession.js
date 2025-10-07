import mongoose from 'mongoose';

const codingSessionSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  language: { type: String, default: 'javascript' },
  prompt: { type: String },
  starterCode: { type: String, default: '' },
  code: { type: String, default: '' },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  lastActivityAt: { type: Date, default: Date.now },
  runCount: { type: Number, default: 0 },
}, { timestamps: true });

codingSessionSchema.index({ application: 1, language: 1 });

export default mongoose.model('CodingSession', codingSessionSchema);
