import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
    );
  }
  return supabaseClient;
}

export function resetSupabaseClient(): void {
  supabaseClient = null;
}
