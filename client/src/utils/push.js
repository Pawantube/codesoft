const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const getAuthHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

export const ensurePushSubscription = async (token) => {
  try {
    if (!VAPID_PUBLIC_KEY) {
      return false;
    }
    if (typeof window === 'undefined') {
      return false;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      if (Notification.permission === 'denied') {
        return false;
      }
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return false;
        }
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await fetch(`${API_URL}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
      },
      body: JSON.stringify({
        subscription,
        userAgent: window.navigator.userAgent,
      }),
    });

    localStorage.setItem('sc-push-subscribed', '1');
    return true;
  } catch (error) {
    console.error('Push subscription failed', error);
    return false;
  }
};

export const removePushSubscription = async (token) => {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      try {
        await fetch(`${API_URL}/api/notifications/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(token),
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      } catch {}

      await subscription.unsubscribe();
    }

    localStorage.removeItem('sc-push-subscribed');
    return true;
  } catch (error) {
    console.error('Push unsubscribe failed', error);
    return false;
  }
};
