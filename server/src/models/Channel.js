import mongoose from 'mongoose';

const channelMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'moderator', 'owner'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const channelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true },
    visibility: { type: String, enum: ['public', 'private', 'company'], default: 'public' },
    joinKey: { type: String, select: false },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [channelMemberSchema],
    tags: [String],
    company: { type: String },
  },
  { timestamps: true }
);

channelSchema.index({ slug: 1 });
channelSchema.index({ name: 1, visibility: 1 });

export default mongoose.model('Channel', channelSchema);
