import "server-only";

import { createClient } from "@supabase/supabase-js";

function getAdminSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Fill server-only env before using Supabase admin client.",
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

/**
 * Server-only Supabase admin client.
 * Use only in Route Handlers or Server Actions that require privileged operations
 * such as creating users. Never import this file from Client Components.
 */
export function createSupabaseAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getAdminSupabaseEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
