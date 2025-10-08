import slugify from 'slugify';
import Channel from '../models/Channel.js';
import ChannelMessage from '../models/ChannelMessage.js';

const buildSlug = async (name) => {
  const base = slugify(name, { lower: true, strict: true });
  if (!base) return `channel-${Date.now()}`;

  let slug = base;
  let counter = 1;
  while (await Channel.findOne({ slug })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
};

const projectMember = (member) => ({
  id: String(member.user?._id || member.user),
  role: member.role,
  name: member.user?.name,
  avatarUrl: member.user?.avatarUrl,
});

export const listChannels = async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { description: new RegExp(q, 'i') },
      { tags: new RegExp(q, 'i') },
    ];
  }

  const channels = await Channel.find(filter)
    .sort({ updatedAt: -1 })
    .populate({ path: 'members.user', select: 'name avatarUrl role' })
    .lean();

  const payload = channels.map((channel) => {
    const member = channel.members?.find((m) => String(m.user?._id || m.user) === String(req.user._id));
    return {
      id: String(channel._id),
      name: channel.name,
      slug: channel.slug,
      description: channel.description,
      visibility: channel.visibility,
      memberCount: channel.members?.length || 0,
      isMember: Boolean(member),
      memberRole: member?.role || null,
      tags: channel.tags || [],
      updatedAt: channel.updatedAt,
    };
  });

  res.json(payload);
};

export const createChannel = async (req, res) => {
  const { name, description, visibility = 'public', tags = [], company } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Channel name is required' });

  const slug = await buildSlug(name);
  const channel = await Channel.create({
    name: name.trim(),
    description: description?.trim(),
    visibility,
    tags: Array.isArray(tags) ? tags : String(tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    company: company || null,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }],
  });

  res.status(201).json({
    id: String(channel._id),
    name: channel.name,
    slug: channel.slug,
    description: channel.description,
    visibility: channel.visibility,
    memberCount: 1,
    isMember: true,
    memberRole: 'owner',
    tags: channel.tags || [],
  });
};

const ensureMember = (channel, userId) =>
  channel.members?.find((m) => String(m.user) === String(userId));

export const joinChannel = async (req, res) => {
  const { id } = req.params;
  const channel = await Channel.findById(id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  if (ensureMember(channel, req.user._id)) {
    return res.json({ ok: true, role: ensureMember(channel, req.user._id).role });
  }

  channel.members.push({ user: req.user._id, role: 'member' });
  await channel.save();

  res.json({ ok: true, role: 'member' });
};

export const leaveChannel = async (req, res) => {
  const { id } = req.params;
  const channel = await Channel.findById(id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const member = ensureMember(channel, req.user._id);
  if (!member) return res.status(400).json({ error: 'Not a member of this channel' });
  if (member.role === 'owner') return res.status(400).json({ error: 'Owner cannot leave the channel' });

  channel.members = channel.members.filter((m) => String(m.user) !== String(req.user._id));
  await channel.save();
  res.json({ ok: true });
};

const canPost = (channel, userId) => Boolean(ensureMember(channel, userId));

export const listMessages = async (req, res) => {
  const { id } = req.params;
  const { before, limit = 50 } = req.query;

  const channel = await Channel.findById(id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!canPost(channel, req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  const query = { channel: id };
  if (before) query.createdAt = { $lt: new Date(before) };

  const messages = await ChannelMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .populate({ path: 'author', select: 'name avatarUrl role' })
    .lean();

  res.json(
    messages
      .reverse()
      .map((message) => ({
        id: String(message._id),
        body: message.body,
        createdAt: message.createdAt,
        author: {
          id: String(message.author?._id || message.author),
          name: message.author?.name,
          avatarUrl: message.author?.avatarUrl,
          role: message.author?.role,
        },
      }))
  );
};

export const postMessage = async (req, res) => {
  const { id } = req.params;
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

  const channel = await Channel.findById(id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!canPost(channel, req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  const message = await ChannelMessage.create({
    channel: id,
    author: req.user._id,
    body: body.trim(),
  });

  channel.updatedAt = new Date();
  await channel.save();

  const payload = {
    id: String(message._id),
    body: message.body,
    createdAt: message.createdAt,
    author: {
      id: String(req.user._id),
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
      role: req.user.role,
    },
  };

  req.io?.to(`channel:${id}`).emit('channel:new-message', payload);

  res.status(201).json(payload);
};
