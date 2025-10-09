import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  referrerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  candidateEmail: { type: String },
  code: { type: String, required: true, unique: true, index: true },
  clickedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending','applied','hired','paid'], default: 'pending', index: true },
  appliedAt: { type: Date },
  hiredAt: { type: Date },
  paidAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('Referral', referralSchema);
