import { createClient } from 'npm:@supabase/supabase-js@2';

const RETENTION_HOURS = {
  'project-attachments': 72,
  'chat-files': 7 * 24,
} as const;
const BUCKETS = Object.keys(RETENTION_HOURS) as Array<keyof typeof RETENTION_HOURS>;

type StoredFile = { path: string; createdAt: string | null };

async function listFiles(client: ReturnType<typeof createClient>, bucket: string, folder = ''): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(folder, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if (item.id) {
        files.push({ path, createdAt: item.created_at ?? null });
      } else {
        files.push(...await listFiles(client, bucket, path));
      }
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return files;
}

function isExpired(file: StoredFile, cutoff: number): boolean {
  if (!file.createdAt) return false;
  const createdAt = Date.parse(file.createdAt);
  return Number.isFinite(createdAt) && createdAt <= cutoff;
}

async function removeMessageReferences(
  client: ReturnType<typeof createClient>,
  deletedPaths: Set<string>,
): Promise<number> {
  if (deletedPaths.size === 0) return 0;
  const { data: messages, error } = await client.from('messages')
    .select('id, attachments').not('attachments', 'is', null);
  if (error) throw error;
  let updated = 0;
  for (const message of messages ?? []) {
    if (!Array.isArray(message.attachments)) continue;
    const remaining = message.attachments.filter(
      (attachment: { path?: string }) => !attachment?.path || !deletedPaths.has(attachment.path),
    );
    if (remaining.length === message.attachments.length) continue;
    const { error: updateError } = await client.from('messages')
      .update({ attachments: remaining }).eq('id', message.id);
    if (updateError) throw updateError;
    updated += 1;
  }
  return updated;
}

Deno.serve(async request => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const expectedSecret = Deno.env.get('CLEANUP_SECRET');
  const suppliedSecret = request.headers.get('x-cleanup-secret');
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return Response.json({ error: 'Not authorized' }, { status: 401 });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return Response.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const client = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const results: Record<string, { checked: number; deleted: number; retentionHours: number }> = {};
    const deletedChatPaths = new Set<string>();

    for (const bucket of BUCKETS) {
      const retentionHours = RETENTION_HOURS[bucket];
      const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
      const files = await listFiles(client, bucket);
      const expired = files.filter(file => isExpired(file, cutoff)).map(file => file.path);
      let deleted = 0;
      for (let index = 0; index < expired.length; index += 100) {
        const batch = expired.slice(index, index + 100);
        const { error } = await client.storage.from(bucket).remove(batch);
        if (error) throw error;
        deleted += batch.length;
        if (bucket === 'chat-files') batch.forEach(path => deletedChatPaths.add(path));
      }
      results[bucket] = { checked: files.length, deleted, retentionHours };
    }

    const messagesUpdated = await removeMessageReferences(client, deletedChatPaths);
    return Response.json({ success: true, results, messagesUpdated });
  } catch (error) {
    console.error('Storage cleanup failed', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Storage cleanup failed' }, { status: 500 });
  }
});
