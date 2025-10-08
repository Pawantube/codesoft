import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import { hasWebPushConfig } from '../utils/webPush.js';

export const listMyNotifications = async (req, res) => {
  const items = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(items);
};

export const markRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ error: 'Not found' });
  res.json(notification);
};

export const markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
};

export const savePushSubscription = async (req, res) => {
  const { subscription, userAgent } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid subscription payload' });
  }

  const payload = {
    user: req.user._id,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    userAgent,
  };

  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ ok: true, pushConfigured: hasWebPushConfig });
};

export const removePushSubscription = async (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) {
    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
  } else {
    await PushSubscription.deleteMany({ user: req.user._id });
  }
  res.json({ ok: true });
};
