import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import { canStartOrSend } from '../utils/chatPolicy.js';

const conversationPopulate = [
  {
    path: 'participants',
    select: 'name email role avatarUrl companyName headline'
  },
  {
    path: 'application',
    select: 'job candidate status',
    populate: [
      { path: 'job', select: 'title company location employer' },
      { path: 'candidate', select: 'name email avatarUrl role' }
    ]
  }
];

const cleanupParticipant = (participantDoc) => {
  if (!participantDoc) return null;
  return {
    id: String(participantDoc._id),
    name: participantDoc.name,
    email: participantDoc.email,
    role: participantDoc.role,
    avatarUrl: participantDoc.avatarUrl || null,
    companyName: participantDoc.companyName || null,
    headline: participantDoc.headline || null
  };
};

const formatConversation = (convo, userId, lastMessage) => {
  const participants = (convo.participants || []).map(cleanupParticipant);
  const otherParticipant = participants.find((p) => p && p.id !== userId) || null;
  const me = participants.find((p) => p && p.id === userId) || null;

  const application = convo.application || null;
  const jobDoc = application && application.job && typeof application.job === 'object'
    ? application.job
    : null;

  const job = jobDoc
    ? {
        id: String(jobDoc._id || ''),
        title: jobDoc.title || '',
        company: jobDoc.company || '',
        location: jobDoc.location || ''
      }
    : null;

  return {
    _id: String(convo._id),
    applicationId: application && application._id ? String(application._id) : null,
    job,
    participants,
    otherParticipant,
    me,
    lastMessageAt: convo.lastMessageAt,
    lastMessage: lastMessage
      ? {
          _id: String(lastMessage._id),
          body: lastMessage.body,
          sender: String(lastMessage.sender),
          recipient: String(lastMessage.recipient),
          createdAt: lastMessage.createdAt,
          readAt: lastMessage.readAt || null
        }
      : null,
    createdAt: convo.createdAt,
    updatedAt: convo.updatedAt
  };
};

const escapeRegex = (str = '') => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

export const getConversations = async (req, res) => {
  const userId = String(req.user._id);
  const convos = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .populate(conversationPopulate)
    .lean();

  if (!convos.length) return res.json([]);

  const convoIds = convos.map((c) => c._id);
  const lastMessages = await Message.aggregate([
    { $match: { conversation: { $in: convoIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversation',
        doc: { $first: '$$ROOT' }
      }
    }
  ]);

  const lastMessageMap = new Map();
  lastMessages.forEach(({ _id, doc }) => {
    lastMessageMap.set(String(_id), {
      _id: doc._id,
      body: doc.body,
      sender: doc.sender,
      recipient: doc.recipient,
      createdAt: doc.createdAt,
      readAt: doc.readAt || null
    });
  });

  const payload = convos.map((convo) =>
    formatConversation(convo, userId, lastMessageMap.get(String(convo._id)))
  );
  res.json(payload);
};

export const getOrCreateConversation = async (req, res) => {
  const { applicationId, otherUserId } = req.body;
  const userId = String(req.user._id);

  const policy = await canStartOrSend({ applicationId, aId: userId, bId: otherUserId });
  if (!policy.ok) return res.status(403).json({ error: policy.reason });

  const participants = [userId, String(otherUserId)];
  const sorted = participants.slice().sort();
  const key = `${applicationId}:${sorted[0]}:${sorted[1]}`;

  let convo = await Conversation.findOne({ key });
  if (!convo) {
    convo = await Conversation.create({ application: applicationId, participants, key });
  }

  const hydrated = await Conversation.findById(convo._id)
    .populate(conversationPopulate)
    .lean();
  const formatted = formatConversation(hydrated, userId, null);
  res.json(formatted);
};

export const getMessages = async (req, res) => {
  const { conversationId, limit = 50, before } = req.query;
  const userId = String(req.user._id);

  const convo = await Conversation.findById(conversationId).lean();
  if (!convo || !convo.participants.map(String).includes(userId)) {
    return res.status(403).json({ error: 'NOT_IN_CONVERSATION' });
  }

  const query = { conversation: conversationId };
  if (before) query.createdAt = { $lt: new Date(before) };

  const msgs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  if (msgs.length) {
    await Message.updateMany(
      {
        conversation: conversationId,
        recipient: userId,
        readAt: { $exists: false }
      },
      { $set: { readAt: new Date() } }
    );
  }

  res.json(msgs.reverse());
};

export const sendMessage = async (req, res) => {
  const { conversationId, body } = req.body;
  const userId = String(req.user._id);

  const convo = await Conversation.findById(conversationId).lean();
  if (!convo || !convo.participants.map(String).includes(userId)) {
    return res.status(403).json({ error: 'NOT_IN_CONVERSATION' });
  }

  const [a, b] = convo.participants.map(String);
  const recipient = a === userId ? b : a;

  const policy = await canStartOrSend({ applicationId: convo.application, aId: userId, bId: recipient });
  if (!policy.ok) return res.status(403).json({ error: policy.reason });

  const msg = await Message.create({ conversation: convo._id, sender: userId, recipient, body });
  await Conversation.findByIdAndUpdate(convo._id, { lastMessageAt: msg.createdAt });

  const payload = msg.toObject({ virtuals: false });
  payload._id = String(payload._id);
  payload.conversation = String(payload.conversation);
  payload.sender = String(payload.sender);
  payload.recipient = String(payload.recipient);

  req.io.to(`conv:${convo._id}`).emit('chat:new', { conversationId: String(convo._id), message: payload });
  req.io.to(`user:${recipient}`).emit('chat:poke', { conversationId: String(convo._id) });

  try {
    const note = await Notification.create({
      user: recipient,
      title: 'New message',
      message: (body || '').slice(0, 140),
      link: `/chat?c=${String(convo._id)}`,
      type: 'application',
    });
    req.io.to(`user:${recipient}`).emit('notify:new', {
      id: String(note._id),
      title: note.title,
      message: note.message,
      link: note.link,
      createdAt: note.createdAt,
    });
  } catch (e) {
    // non-fatal
  }

  res.status(201).json(payload);
};

export const markRead = async (req, res) => {
  const { conversationId } = req.body;
  const userId = String(req.user._id);

  const convo = await Conversation.findById(conversationId).lean();
  if (!convo || !convo.participants.map(String).includes(userId)) {
    return res.status(403).json({ error: 'NOT_IN_CONVERSATION' });
  }

  await Message.updateMany(
    { conversation: conversationId, recipient: userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } }
  );
  res.json({ ok: true });
};

const addResult = (map, key, value) => {
  if (!map.has(key)) map.set(key, value);
};

export const searchChatPartners = async (req, res) => {
  const query = (req.query.q || '').trim();
  if (query.length < 2) return res.json([]);

  const regex = new RegExp(escapeRegex(query), 'i');
  const userId = String(req.user._id);
  const results = new Map();

  if (req.user.role === 'candidate') {
    const applications = await Application.find({ candidate: userId })
      .populate({
        path: 'job',
        select: 'title company employer team',
        populate: [
          { path: 'employer', select: 'name email role avatarUrl companyName headline' },
          { path: 'team', select: 'name email role avatarUrl companyName headline' }
        ]
      })
      .lean();

    applications.forEach((app) => {
      if (!app.job) return;
      const job = app.job;
      const jobSummary = {
        id: String(job._id),
        title: job.title || '',
        company: job.company || ''
      };

      const pushContact = (contact, relation) => {
        if (!contact) return;
        if (!regex.test(contact.name || '') && !regex.test(contact.email || '') && !regex.test(contact.companyName || '')) return;
        const key = `${contact._id}:${app._id}`;
        addResult(results, key, {
          userId: String(contact._id),
          name: contact.name,
          email: contact.email,
          role: contact.role,
          avatarUrl: contact.avatarUrl || null,
          companyName: contact.companyName || null,
          headline: contact.headline || null,
          applicationId: String(app._id),
          job: jobSummary,
          relation
        });
      };

      pushContact(job.employer, 'employer');
      if (Array.isArray(job.team)) {
        job.team.forEach((member) => pushContact(member, 'team'));
      }
    });
  } else if (req.user.role === 'employer') {
    const jobs = await Job.find({ employer: userId }).select('_id title company').lean();
    const jobById = new Map(jobs.map((job) => [String(job._id), job]));
    const jobIds = jobs.map((job) => job._id);

    if (jobIds.length) {
      const applications = await Application.find({ job: { $in: jobIds } })
        .populate({ path: 'candidate', select: 'name email role avatarUrl headline' })
        .lean();

      applications.forEach((app) => {
        if (!app.candidate) return;
        if (!regex.test(app.candidate.name || '') && !regex.test(app.candidate.email || '') && !regex.test(app.candidate.headline || '')) return;
        const job = jobById.get(String(app.job));
        const key = `${app.candidate._id}:${app._id}`;
        addResult(results, key, {
          userId: String(app.candidate._id),
          name: app.candidate.name,
          email: app.candidate.email,
          role: app.candidate.role,
          avatarUrl: app.candidate.avatarUrl || null,
          headline: app.candidate.headline || null,
          applicationId: String(app._id),
          job: job
            ? { id: String(job._id), title: job.title || '', company: job.company || '' }
            : null,
          relation: 'candidate'
        });
      });
    }
  } else {
    return res.json([]);
  }

  res.json(Array.from(results.values()).slice(0, 15));
};
