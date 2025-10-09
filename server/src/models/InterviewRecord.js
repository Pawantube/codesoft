import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const interviewRecordSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, unique: true, index: true },
  notes: { type: [noteSchema], default: [] },
  transcriptText: { type: String, default: '' },
  summaryText: { type: String, default: '' },
  tokensUsed: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('InterviewRecord', interviewRecordSchema);
