"use client";

import type { AppUser, UserRole } from "../types";
import { createSupabaseBrowserClient } from "./supabase/client";

interface UserProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  laboratory_id?: string | null;
  is_active: boolean;
}

let cachedCurrentUser: AppUser | null = null;
let cachedCurrentUserAt = 0;
let currentUserRequest: Promise<{
  user: AppUser | null;
  error: string | null;
}> | null = null;
let currentUserRequestGeneration = 0;
const PROFILE_CACHE_TTL_MS = 5 * 60_000;
const AUTH_VALIDATION_TIMEOUT_MS = 5_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutResult = new Promise<null>((resolve) => {
    timeout = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutResult]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function clearCachedCurrentUser(): void {
  currentUserRequestGeneration += 1;
  cachedCurrentUser = null;
  cachedCurrentUserAt = 0;
  currentUserRequest = null;
}

function mapUserProfile(row: UserProfileRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    laboratoryId: row.laboratory_id ?? null,
    isActive: row.is_active,
  };
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Layanan autentikasi sedang tidak tersedia. Silakan coba kembali.";
}

export async function signInWithEmailPassword(email: string, password: string) {
  try {
    clearCachedCurrentUser();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return { user: null, error: error?.message ?? "Login gagal. Data pengguna tidak tersedia." };
    }

    const result = await loadUserProfile(data.user.id);
    cachedCurrentUser = result.user;
    cachedCurrentUserAt = result.user ? Date.now() : 0;
    return result;
  } catch (error) {
    return { user: null, error: getAuthErrorMessage(error) };
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: error.message };
    }

    clearCachedCurrentUser();
    return { error: null };
  } catch (error) {
    return { error: getAuthErrorMessage(error) };
  }
}

export async function getCurrentSession() {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) return { session: null, error: error.message };
    return { session: data.session, error: null };
  } catch (error) {
    return { session: null, error: getAuthErrorMessage(error) };
  }
}

async function loadUserProfile(userId: string): Promise<{
  user: AppUser | null;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id,email,full_name,role,laboratory_id,is_active")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return { user: null, error: "Profil pengguna belum dibuat. Hubungi admin." };
    }

    const mapped = mapUserProfile(profile as UserProfileRow);
    if (!mapped.isActive) {
      return { user: null, error: "Akun tidak aktif. Hubungi admin." };
    }

    return { user: mapped, error: null };
  } catch (error) {
    return { user: null, error: getAuthErrorMessage(error) };
  }
}

async function loadCurrentUserProfile(): Promise<{
  user: AppUser | null;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const authResult = await withTimeout(
      supabase.auth.getUser(),
      AUTH_VALIDATION_TIMEOUT_MS,
    );

    if (!authResult) {
      void supabase.auth.signOut({ scope: "local" });
      return { user: null, error: "Validasi sesi terlalu lama. Silakan masuk kembali." };
    }

    const { data: authData, error: authError } = authResult;

    if (authError || !authData.user) {
      return { user: null, error: authError?.message ?? null };
    }

    return await loadUserProfile(authData.user.id);
  } catch (error) {
    return { user: null, error: getAuthErrorMessage(error) };
  }
}

export function getCurrentUserProfile(options: { forceRefresh?: boolean } = {}): Promise<{
  user: AppUser | null;
  error: string | null;
}> {
  if (
    !options.forceRefresh &&
    cachedCurrentUser &&
    Date.now() - cachedCurrentUserAt < PROFILE_CACHE_TTL_MS
  ) {
    return Promise.resolve({ user: cachedCurrentUser, error: null });
  }

  if (currentUserRequest) return currentUserRequest;

  const requestGeneration = currentUserRequestGeneration;
  currentUserRequest = loadCurrentUserProfile()
    .then((result) => {
      if (requestGeneration !== currentUserRequestGeneration) {
        return { user: null, error: null };
      }
      cachedCurrentUser = result.user;
      cachedCurrentUserAt = result.user ? Date.now() : 0;
      return result;
    })
    .finally(() => {
      if (requestGeneration === currentUserRequestGeneration) {
        currentUserRequest = null;
      }
    });
  return currentUserRequest;
}

/**
 * Temporary synchronous accessor for legacy client components that have not
 * been migrated yet. AppShell populates this cache after Supabase profile load.
 */
export function getCurrentUser(): AppUser | null {
  return cachedCurrentUser;
}

/** Backward-compatible alias for components still importing logout. */
export async function logout(): Promise<void> {
  const { error } = await signOut();
  if (error) throw new Error(error);
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    mahasiswa: "Mahasiswa",
    dosen: "Dosen",
    teknisi: "Teknisi/Laboran",
    kepala_lab: "Kepala Laboratorium",
    admin: "Admin Sistem",
  };
  return labels[role] ?? role;
}
