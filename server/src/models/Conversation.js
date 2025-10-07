import mongoose from 'mongoose';
const { Schema, Types } = mongoose;

const ConversationSchema = new Schema(
  {
    application:  { type: Types.ObjectId, ref: 'Application', required: true, index: true },
    participants: [{ type: Types.ObjectId, ref: 'User', required: true }], // exactly 2
    key:          { type: String, unique: true, index: true },
    lastMessageAt:{ type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

ConversationSchema.pre('validate', function (next) {
  if (this.participants?.length === 2) {
    const sorted = this.participants.map(String).sort();
    this.key = `${this.application}:${sorted[0]}:${sorted[1]}`;
  }
  next();
});

export default mongoose.model('Conversation', ConversationSchema);
