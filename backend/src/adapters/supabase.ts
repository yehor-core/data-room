import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { FileStorage, TokenVerifier } from '../ports';

const BUCKET = 'data-room-files';

/** One service-role client for both storage and token verification. */
export function createSupabaseAdapters({ url, serviceRoleKey }: { url: string; serviceRoleKey: string }) {
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bucket = () => supabase.storage.from(BUCKET);

  const storage: FileStorage = {
    async put({ name, content, contentType }) {
      const path = `uploads/${randomUUID()}${extname(name).toLowerCase()}`;
      const { error } = await bucket().upload(path, content, { contentType, upsert: false });
      if (error) throw new Error(`Failed to upload file: ${error.message}`);
      return path;
    },

    async signedUrl(path, expiresInSeconds) {
      const { data, error } = await bucket().createSignedUrl(path, expiresInSeconds);
      if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
      return data.signedUrl;
    },

    async remove(paths) {
      const { error } = await bucket().remove(paths);
      if (error) throw new Error(`Failed to delete files: ${error.message}`);
    },
  };

  const tokenVerifier: TokenVerifier = {
    async verify(token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user.email) return null;
      return { email: data.user.email, name: data.user.user_metadata?.full_name ?? null };
    },
  };

  return { storage, tokenVerifier };
}
