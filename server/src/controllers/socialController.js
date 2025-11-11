import User from '../models/User.js';
import Post from '../models/Post.js';

const sanitize = (u) => {
  if (!u) return null;
  const { password, __v, followers, following, ...rest } = u.toObject ? u.toObject() : u;
  return { ...rest, followersCount: (u.followers||[]).length, followingCount: (u.following||[]).length };
};

export const getProfile = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const me = String(req.user?._id || '');
  const following = Array.isArray(user.followers) ? user.followers.some((x)=>String(x)===me) : false;
  return res.json({ ...sanitize(user), isFollowing: following });
};

export const followUser = async (req, res) => {
  const { id } = req.params; // target
  const me = String(req.user._id);
  if (me === String(id)) return res.status(400).json({ error: 'Cannot follow yourself' });
  const target = await User.findById(id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const meDoc = await User.findById(me);
  if (!meDoc) return res.status(401).json({ error: 'Unauthorized' });

  if (!meDoc.following) meDoc.following = [];
  if (!target.followers) target.followers = [];

  if (!meDoc.following.find((u) => String(u) === String(id))) meDoc.following.push(target._id);
  if (!target.followers.find((u) => String(u) === me)) target.followers.push(meDoc._id);

  await meDoc.save();
  await target.save();
  return res.json({ ok: true });
};

export const unfollowUser = async (req, res) => {
  const { id } = req.params; // target
  const me = String(req.user._id);
  const target = await User.findById(id);
  const meDoc = await User.findById(me);
  if (!target || !meDoc) return res.status(404).json({ error: 'User not found' });

  meDoc.following = (meDoc.following||[]).filter((u) => String(u) !== String(id));
  target.followers = (target.followers||[]).filter((u) => String(u) !== me);
  await meDoc.save();
  await target.save();
  return res.json({ ok: true });
};

export const listUserPosts = async (req, res) => {
  const { id } = req.params;
  const { before, limit = 20 } = req.query;
  const filter = { author: id };
  if (before) filter.createdAt = { $lt: new Date(before) };
  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 50))
    .populate({ path: 'author', select: 'name avatarUrl role headline companyName' })
    .lean();
  res.json(posts.map((p) => ({ ...p, id: String(p._id) })));
};
