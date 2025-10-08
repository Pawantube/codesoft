import mongoose from 'mongoose';
const { Schema, Types } = mongoose;

const MessageSchema = new Schema(
  {
    conversation: { type: Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender:       { type: Types.ObjectId, ref: 'User', required: true, index: true },
    recipient:    { type: Types.ObjectId, ref: 'User', required: true, index: true },
    body:         { type: String, trim: true, default: '' },
    readAt:       { type: Date }
  },
  { timestamps: true }
);
MessageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.model('Message', MessageSchema);
