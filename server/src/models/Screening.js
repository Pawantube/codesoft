import mongoose from 'mongoose';

const screeningSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, unique: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['requested', 'submitted', 'reviewed'], default: 'requested' },
  videoUrl: { type: String, default: '' },
  durationSec: { type: Number, default: 0 },
  reviewerNotes: { type: String, default: '' },
  reviewedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('Screening', screeningSchema);
