import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, default: '' },
  tag: { type: String, enum: ['general', 'strength', 'concern', 'next_step'], default: 'general' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const criterionSchema = new mongoose.Schema({
  questionId: { type: String },
  criterion: { type: String },
  score: { type: Number, min: 0, max: 5 },
  rationale: { type: String },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  id: { type: String },
  text: { type: String, required: true },
  weight: { type: Number, default: 1 },
  category: { type: String },
}, { _id: false });

const interviewRecordSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, unique: true, index: true },
  notes: { type: [noteSchema], default: [] },
  transcriptText: { type: String, default: '' },
  summaryText: { type: String, default: '' },
  questions: { type: [questionSchema], default: [] },
  scorecard: {
    overallScore: { type: Number, default: 0 },
    summary: { type: String, default: '' },
    criteria: { type: [criterionSchema], default: [] },
    model: { type: String },
    provider: { type: String },
    generatedAt: { type: Date },
  },
  tokensUsed: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('InterviewRecord', interviewRecordSchema);
