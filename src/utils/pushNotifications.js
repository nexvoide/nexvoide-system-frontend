import { supabase } from '../lib/supabase.js';

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function syncPushSubscription() {
  if (!supabase || !isPushNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim();
  if (!publicKey) {
    console.warn('Push notifications require VITE_WEB_PUSH_PUBLIC_KEY.');
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicKey),
    });
  }

  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }

  const { error } = await supabase.rpc('upsert_push_subscription', {
    requested_endpoint: serialized.endpoint,
    requested_p256dh: serialized.keys.p256dh,
    requested_auth: serialized.keys.auth,
    requested_user_agent: navigator.userAgent,
  });

  if (error) throw error;
  return true;
}

export async function enablePushNotifications() {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported by this browser.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') return false;
  return syncPushSubscription();
}
