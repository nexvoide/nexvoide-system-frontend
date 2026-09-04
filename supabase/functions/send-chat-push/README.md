# Closed-app chat push notifications

## 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Set the generated public key as `VITE_WEB_PUSH_PUBLIC_KEY` in the frontend build environment.

## 2. Apply the database migration

Run `database/migrations/008-web-push-notifications.sql` in the Supabase SQL editor.

## 3. Configure and deploy the Edge Function

```bash
supabase secrets set \
  WEB_PUSH_PUBLIC_KEY="PUBLIC_KEY" \
  WEB_PUSH_PRIVATE_KEY="PRIVATE_KEY" \
  WEB_PUSH_SUBJECT="mailto:admin@nexvoide.com" \
  CHAT_PUSH_WEBHOOK_SECRET="A_LONG_RANDOM_SECRET"

supabase functions deploy send-chat-push --no-verify-jwt
```

## 4. Create the database webhook

In Supabase Dashboard, open **Database > Webhooks > Create webhook**:

- Name: `send-chat-push`
- Table: `public.messages`
- Event: `INSERT`
- Type: Supabase Edge Function
- Function: `send-chat-push`
- HTTP header: `x-webhook-secret: A_LONG_RANDOM_SECRET`

## 5. Device requirements

- The user must press **Enable notifications** once on every device.
- Android browsers can receive closed-app web push after permission is granted.
- On iPhone/iPad, the site must be installed to the Home Screen before Web Push can be enabled.
- Notification sound is controlled by the device/browser notification settings. The payload requests sound and vibration, but websites cannot force sound if the device is silent or the notification category is muted.
