import "server-only";

import type { UserRole } from "@/types";

export interface DemoAccountDefinition {
  email: string;
  fullName: string;
  role: UserRole;
}

export const DEMO_ACCOUNTS: Record<UserRole, DemoAccountDefinition> = {
  mahasiswa: {
    email: "demo.mahasiswa@vocasafe.id",
    fullName: "Demo Mahasiswa",
    role: "mahasiswa",
  },
  dosen: {
    email: "demo.dosen@vocasafe.id",
    fullName: "Demo Dosen",
    role: "dosen",
  },
  teknisi: {
    email: "demo.teknisi@vocasafe.id",
    fullName: "Demo Teknisi Laboratorium",
    role: "teknisi",
  },
  kepala_lab: {
    email: "demo.kepala-lab@vocasafe.id",
    fullName: "Demo Kepala Laboratorium",
    role: "kepala_lab",
  },
  admin: {
    email: "demo.admin@vocasafe.id",
    fullName: "Demo Admin Sistem",
    role: "admin",
  },
};

export function isDemoModeEnabled(): boolean {
  const configured = process.env.DEMO_MODE_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function getDemoCredentials(role: UserRole): {
  email: string;
  password: string;
} | null {
  if (!isDemoModeEnabled()) return null;

  const password = process.env.DEMO_ACCOUNT_PASSWORD?.trim();
  if (password) return { email: DEMO_ACCOUNTS[role].email, password };
  return null;
}
