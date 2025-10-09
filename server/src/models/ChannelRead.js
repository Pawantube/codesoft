import mongoose from 'mongoose';

const channelReadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

channelReadSchema.index({ user: 1, channel: 1 }, { unique: true });

export default mongoose.model('ChannelRead', channelReadSchema);
