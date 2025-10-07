import mongoose from 'mongoose';

const channelMessageSchema = new mongoose.Schema(
  {
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true },
    pinned: { type: Boolean, default: false },
    meta: {
      attachments: [{ url: String, name: String }],
    },
  },
  { timestamps: true }
);

channelMessageSchema.index({ channel: 1, createdAt: -1 });

export default mongoose.model('ChannelMessage', channelMessageSchema);
