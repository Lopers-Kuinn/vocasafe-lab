import type { UserRole } from "../types";

type RouteKey =
  | "/dashboard"
  | "/scan"
  | "/assets"
  | "/reports"
  | "/reports/new"
  | "/checklists"
  | "/checklists/new"
  | "/audit"
  | "/admin";

const ACCESS_MATRIX: Record<RouteKey, UserRole[]> = {
  "/dashboard": ["mahasiswa", "dosen", "teknisi", "kepala_lab", "admin"],
  "/scan": ["mahasiswa", "dosen", "teknisi", "admin"],
  "/assets": ["mahasiswa", "dosen", "teknisi", "kepala_lab", "admin"],
  "/reports": ["mahasiswa", "dosen", "teknisi", "kepala_lab", "admin"],
  "/reports/new": ["mahasiswa", "dosen", "teknisi", "admin"],
  "/checklists": ["dosen", "teknisi", "kepala_lab", "admin"],
  "/checklists/new": ["dosen", "teknisi", "admin"],
  "/audit": ["teknisi", "kepala_lab", "admin"],
  "/admin": ["admin"],
};

function normalizeRoute(route: string): RouteKey | null {
  if (route === "/reports/new") return "/reports/new";
  if (route.startsWith("/reports/")) return "/reports";
  if (route === "/checklists/new") return "/checklists/new";
  if (route.startsWith("/checklists/")) return "/checklists";
  if (route.startsWith("/audit/")) return "/audit";
  if (route.startsWith("/scan/")) return "/scan";
  if (route.startsWith("/assets/")) return "/assets";
  if (route === "/admin" || route.startsWith("/admin/")) return "/admin";
  if (Object.prototype.hasOwnProperty.call(ACCESS_MATRIX, route)) {
    return route as RouteKey;
  }
  return null;
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const normalized = normalizeRoute(route);
  if (!normalized) return true; // routes not in matrix are open
  return ACCESS_MATRIX[normalized].includes(role);
}

/** Only teknisi and admin can update report status / add follow-up */
export function canEditReportStatus(role: UserRole): boolean {
  return role === "teknisi" || role === "admin";
}

/** Admin is global; teknisi may manage assets only inside their assigned lab. */
export function canManageAssetData(
  role: UserRole,
  userLaboratoryId: string | null | undefined,
  assetLaboratoryId?: string | null,
): boolean {
  if (role === "admin") return true;
  if (role !== "teknisi" || !userLaboratoryId) return false;
  return assetLaboratoryId === undefined || assetLaboratoryId === userLaboratoryId;
}
