import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

const { WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, FROM_EMAIL } = process.env;

const contactEmail = FROM_EMAIL?.match(/<([^>]+)>/)?.[1] || FROM_EMAIL || 'no-reply@sawconnect.app';

// Ensure keys are URL-safe Base64 (replace +/ with -_ and strip =) as required by web-push
const toUrlSafeB64 = (s) => (s || '')
  .trim()
  .replace(/\s+/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

let vapidConfigured = false;
try {
  if (WEB_PUSH_PUBLIC_KEY && WEB_PUSH_PRIVATE_KEY) {
    const pub = toUrlSafeB64(WEB_PUSH_PUBLIC_KEY);
    const prv = toUrlSafeB64(WEB_PUSH_PRIVATE_KEY);
    const urlSafeRe = /^[A-Za-z0-9_-]+$/;
    if (urlSafeRe.test(pub) && urlSafeRe.test(prv)) {
      webpush.setVapidDetails(`mailto:${contactEmail}`, pub, prv);
      vapidConfigured = true;
    } else {
      console.warn('[WebPush] VAPID keys not URL-safe after normalization. Web push disabled.');
    }
  }
} catch (e) {
  console.warn('[WebPush] Failed to initialize VAPID. Web push disabled.', e?.message || e);
}

export const hasWebPushConfig = Boolean(vapidConfigured);

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
