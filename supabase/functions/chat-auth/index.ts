import { createClient } from 'npm:@supabase/supabase-js@2';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  const configured = (Deno.env.get('CLIENT_URL') ?? '')
    .split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
  if (!origin) return configured[0] ?? null;
  return configured.includes(origin.replace(/\/$/, '')) ? origin : null;
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function rateLimitKey(request: Request, username: string): string {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
  return `${address}:${username.toLocaleLowerCase()}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

Deno.serve(async request => {
  const origin = allowedOrigin(request);
  if (request.headers.get('origin') && !origin) return json({ error: 'Request origin is not allowed' }, 403, null);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  try {
    const payload = await request.json();
    if (payload?.action === 'set-user-password' || payload?.action === 'delete-user') {
      const authorization = request.headers.get('authorization') ?? '';
      const token = authorization.replace(/^Bearer\s+/i, '');
      const targetUserId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
      const newPassword = typeof payload?.password === 'string' ? payload.password : '';
      if (!token || !targetUserId || (payload.action === 'set-user-password' && (newPassword.length < 8 || newPassword.length > 1024))) {
        return json({ error: 'Invalid request' }, 400, origin);
      }
      const url = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !serviceKey) return json({ error: 'Authentication service unavailable' }, 503, origin);
      const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: authData, error: authError } = await admin.auth.getUser(token);
      if (authError || !authData.user) return json({ error: 'Not authorized' }, 401, origin);
      const { data: manager } = await admin.from('users').select('role, active')
        .eq('auth_user_id', authData.user.id).maybeSingle();
      const roles = String(manager?.role ?? '').toLocaleLowerCase();
      if (manager?.active === false || !['admin', 'administrator', 'manager'].some(role => roles.includes(role))) {
        return json({ error: 'Not authorized' }, 403, origin);
      }
      const { data: target, error: targetError } = await admin.from('users')
        .select('id, username, email, role, active, auth_user_id').eq('id', targetUserId).maybeSingle();
      if (targetError || !target) return json({ error: 'User not found' }, 404, origin);
      if (payload.action === 'delete-user') {
        if (target.auth_user_id === authData.user.id) return json({ error: 'You cannot delete your own account' }, 409, origin);
        const { error: deleteAppUserError } = await admin.from('users').delete().eq('id', target.id);
        if (deleteAppUserError) return json({ error: 'Unable to delete user' }, 500, origin);
        if (target.auth_user_id) {
          const { error: deleteAuthUserError } = await admin.auth.admin.deleteUser(target.auth_user_id);
          if (deleteAuthUserError) return json({ error: 'User removed, but authentication-account cleanup failed' }, 500, origin);
        }
        return json({ success: true }, 200, origin);
      }
      const targetEmail = target.email?.trim() || `${target.id}@users.nexvoide.invalid`;
      if (target.auth_user_id) {
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
          password: newPassword,
          email: targetEmail,
          app_metadata: { nexvoide_user_id: target.id, roles: target.role },
        });
        if (authUpdateError) return json({ error: 'Unable to update password' }, 500, origin);
      } else {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: targetEmail,
          password: newPassword,
          email_confirm: true,
          app_metadata: { nexvoide_user_id: target.id, roles: target.role },
          user_metadata: { username: target.username },
        });
        if (createError || !created.user) return json({ error: 'Unable to create the authentication account' }, 500, origin);

        const { data: linked, error: linkError } = await admin.from('users')
          .update({ auth_user_id: created.user.id })
          .eq('id', target.id)
          .is('auth_user_id', null)
          .select('auth_user_id')
          .maybeSingle();
        if (linkError || !linked) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json({ error: 'Unable to link the authentication account' }, 409, origin);
        }
      }
      return json({ success: true }, 200, origin);
    }

    const username = typeof payload?.username === 'string' ? payload.username.trim() : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    if (!username || username.length > 100 || !password || password.length > 1024) {
      return json({ error: 'Invalid username or password' }, 401, origin);
    }
    const key = rateLimitKey(request, username);
    if (isRateLimited(key)) return json({ error: 'Invalid username or password' }, 429, origin);

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json({ error: 'Authentication service unavailable' }, 503, origin);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: appUser, error: userError } = await admin.from('users')
      .select('id, username, email, role, active, auth_user_id')
      .ilike('username', username).maybeSingle();
    if (userError || !appUser || appUser.active === false) {
      return json({ error: 'Invalid username or password' }, 401, origin);
    }

    const email = appUser.email?.trim() || `${appUser.id}@users.nexvoide.invalid`;
    if (!appUser.auth_user_id) return json({ error: 'Invalid username or password' }, 401, origin);

    const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) return json({ error: 'Invalid username or password' }, 401, origin);

    attempts.delete(key);
    return json({ access_token: signIn.session.access_token, refresh_token: signIn.session.refresh_token }, 200, origin);
  } catch {
    return json({ error: 'Authentication service unavailable' }, 503, origin);
  }
});
