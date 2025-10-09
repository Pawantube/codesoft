import mongoose from 'mongoose';

const embeddingsSchema = new mongoose.Schema({
  docId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, enum: ['job', 'profile'], required: true, index: true },
  vector: { type: [Number], default: [] },
  meta: { type: Object, default: {} },
}, { timestamps: true });

embeddingsSchema.index({ type: 1, docId: 1 }, { unique: true });

export default mongoose.model('Embeddings', embeddingsSchema);
