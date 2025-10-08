import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'video', null], default: null },
    tags: [{ type: String }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentsCount: { type: Number, default: 0 },
    company: { type: String },
    visibility: { type: String, enum: ['public', 'company'], default: 'public' },
  },
  { timestamps: true }
);

export default mongoose.model('Post', postSchema);
