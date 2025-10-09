import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

const { WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, FROM_EMAIL } = process.env;

const contactEmail = FROM_EMAIL?.match(/<([^>]+)>/)?.[1] || FROM_EMAIL || 'no-reply@sawconnect.app';

if (WEB_PUSH_PUBLIC_KEY && WEB_PUSH_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${contactEmail}`, WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY);
}

export const hasWebPushConfig = Boolean(WEB_PUSH_PUBLIC_KEY && WEB_PUSH_PRIVATE_KEY);

export const sendWebPush = async ({ subscription, payload }) => {
  if (!hasWebPushConfig) return;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      try {
        await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
      } catch {}
    } else {
      console.error('Web push delivery failed', error);
    }
  }
};

export const sendWebPushToUser = async ({ userId, payload }) => {
  if (!hasWebPushConfig) return;
  try {
    const subs = await PushSubscription.find({ user: userId }).lean();
    await Promise.all(
      subs.map((s) =>
        sendWebPush({
          subscription: {
            endpoint: s.endpoint,
            keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
          },
          payload,
        })
      )
    );
  } catch (e) {
    // non-fatal
  }
};
