import mongoose from 'mongoose';

const InterestSchema = new mongoose.Schema(
  {
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

InterestSchema.index({ employer: 1, candidate: 1 }, { unique: true });

export default mongoose.model('Interest', InterestSchema);
