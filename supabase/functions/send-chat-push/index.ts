import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type MessageRecord = {
  id: string;
  channel_id: string;
  author_id: string;
  content?: string | null;
  user_name?: string | null;
  attachments?: unknown[] | null;
  created_at?: string | null;
};

type WebhookPayload = {
  type: 'INSERT';
  table: 'messages';
  schema: 'public';
  record: MessageRecord;
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async request => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const expectedSecret = Deno.env.get('CHAT_PUSH_WEBHOOK_SECRET');
  if (!expectedSecret || request.headers.get('x-webhook-secret') !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('WEB_PUSH_SUBJECT');

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse({ error: 'Push notification secrets are not configured' }, 500);
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const message = payload?.record;
  if (payload.type !== 'INSERT' || payload.table !== 'messages' || !message?.id || !message.channel_id) {
    return jsonResponse({ error: 'Invalid message webhook payload' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: channel, error: channelError }, { data: author, error: authorError }] = await Promise.all([
    admin.from('channels').select('name').eq('id', message.channel_id).maybeSingle(),
    admin.from('users').select('name, username').eq('id', message.author_id).maybeSingle(),
  ]);

  if (channelError || authorError) {
    return jsonResponse({ error: channelError?.message || authorError?.message }, 500);
  }

  const { data: memberships, error: membershipError } = await admin
    .from('channel_members')
    .select('user_id')
    .eq('channel_id', message.channel_id)
    .neq('user_id', message.author_id);

  if (membershipError) return jsonResponse({ error: membershipError.message }, 500);

  const recipientIds = [...new Set((memberships || []).map(item => item.user_id).filter(Boolean))];
  if (recipientIds.length === 0) return jsonResponse({ delivered: 0, removed: 0 });

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', recipientIds);

  if (subscriptionError) return jsonResponse({ error: subscriptionError.message }, 500);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const senderName = author?.name || author?.username || message.user_name || 'New message';
  const channelName = channel?.name || 'Chat';
  const content = message.content?.trim() || (message.attachments?.length ? 'Sent an attachment' : 'New message');
  const notificationPayload = JSON.stringify({
    title: senderName,
    body: `${channelName} · ${content.length > 96 ? `${content.slice(0, 93)}…` : content}`,
    tag: `chat-message-${message.id}`,
    timestamp: message.created_at ? Date.parse(message.created_at) : Date.now(),
    data: {
      url: `/?tab=chat&channel=${encodeURIComponent(message.channel_id)}`,
      channelId: message.channel_id,
      messageId: message.id,
    },
  });

  let delivered = 0;
  const expiredIds: string[] = [];
  await Promise.allSettled((subscriptions || []).map(async subscription => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, notificationPayload, { TTL: 86400, urgency: 'high' });
      delivered += 1;
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) expiredIds.push(subscription.id);
      else console.error('Push delivery failed', error);
    }
  }));

  if (expiredIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds);
  }

  return jsonResponse({ delivered, removed: expiredIds.length });
});
