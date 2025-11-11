import Post from '../models/Post.js';
import cloudinary from '../utils/cloudinary.js';
import Comment from '../models/Comment.js';

const parseList = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
};

const uploadMediaFromBuffer = (file) =>
  new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const isVideo = file.mimetype?.startsWith('video/');
    const options = {
      resource_type: isVideo ? 'video' : 'image',
      folder: isVideo ? 'sawconnect/post_videos' : 'sawconnect/post_images',
      filename_override: file.originalname || (isVideo ? 'video' : 'image'),
      use_filename: true,
      overwrite: false,
    };
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      return resolve({ url: result.secure_url, type: isVideo ? 'video' : 'image' });
    });
    stream.end(file.buffer);
  });

export const list = async (req, res) => {
  const { q, author, limit = 20, before } = req.query;
  const filter = {};
  if (q) filter.body = new RegExp(q, 'i');
  if (author) filter.author = author;
  if (before) filter.createdAt = { $lt: new Date(before) };

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 50))
    .populate({ path: 'author', select: 'name avatarUrl role headline companyName' })
    .lean();
  res.json(posts.map((p) => ({ ...p, id: String(p._id) })));
};

export const feed = async (req, res) => {
  const { q, limit = 20, before } = req.query;
  const filter = {};
  if (q) filter.body = new RegExp(q, 'i');
  if (before) filter.createdAt = { $lt: new Date(before) };

  // Build authors list: followed + self
  const me = req.user?._id;
  const following = Array.isArray(req.user?.following) ? req.user.following : [];
  const authors = [...new Set([...(following || []).map((x)=>x), me].filter(Boolean))];
  if (authors.length) filter.author = { $in: authors };

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 50))
    .populate({ path: 'author', select: 'name avatarUrl role headline companyName' })
    .lean();
  res.json(posts.map((p) => ({ ...p, id: String(p._id) })));
};

export const create = async (req, res) => {
  const { body, tags, visibility = 'public', company } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Post body is required' });

  let mediaUrl, mediaType;
  if (req.file && req.file.buffer) {
    try {
      const up = await uploadMediaFromBuffer(req.file);
      if (up) { mediaUrl = up.url; mediaType = up.type; }
    } catch (e) {
      return res.status(500).json({ error: 'Media upload failed', details: e?.message });
    }
  }

  const post = await Post.create({
    author: req.user._id,
    body: body.trim(),
    mediaUrl,
    mediaType: mediaType || null,
    tags: parseList(tags),
    visibility,
    company: company || undefined,
  });

  const populated = await Post.findById(post._id)
    .populate({ path: 'author', select: 'name avatarUrl role headline companyName' })
    .lean();
  res.status(201).json({ ...populated, id: String(populated._id) });
};

export const toggleLike = async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const uid = String(req.user._id);
  const idx = post.likes.findIndex((u) => String(u) === uid);
  if (idx >= 0) post.likes.splice(idx, 1);
  else post.likes.push(req.user._id);
  await post.save();
  res.json({ id: String(post._id), likes: post.likes.length, liked: idx < 0 });
};

export const remove = async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (String(post.author) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });
  await Post.deleteOne({ _id: id });
  res.json({ ok: true });
};

// Comments
export const listComments = async (req, res) => {
  const { id } = req.params;
  const comments = await Comment.find({ post: id })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate({ path: 'author', select: 'name avatarUrl' })
    .lean();
  res.json(comments.map((c) => ({ ...c, id: String(c._id) })));
};

export const addComment = async (req, res) => {
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Comment body required' });
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = await Comment.create({ post: id, author: req.user._id, body: String(body).trim() });
  post.commentsCount = (post.commentsCount || 0) + 1;
  await post.save();
  const populated = await Comment.findById(comment._id).populate({ path: 'author', select: 'name avatarUrl' }).lean();
  res.status(201).json({ ...populated, id: String(populated._id) });
};
