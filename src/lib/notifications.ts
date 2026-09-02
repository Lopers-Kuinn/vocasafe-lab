"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type NotificationPriority = "normal" | "high" | "critical";
export type NotificationType =
  | "report_new"
  | "report_status"
  | "report_assigned"
  | "corrective_action";

export interface OperationalNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entityType: "report" | "checklist";
  entityId: string;
  href: string;
  dueAt: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: "report" | "checklist";
  entity_id: string;
  href: string;
  due_at: string | null;
  read_at: string | null;
  created_at: string;
}

function isMigrationUnavailable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        /user_notifications.*does not exist|could not find the table/i.test(error.message ?? "")),
  );
}

function mapNotification(row: NotificationRow): OperationalNotification {
  return {
    id: row.id,
    type: row.notification_type,
    priority: row.priority,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    href: row.href,
    dueAt: row.due_at,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function fetchOperationalNotifications(limit = 40): Promise<{
  notifications: OperationalNotification[];
  unavailable: boolean;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("user_notifications")
      .select(
        "id,notification_type,priority,title,body,entity_type,entity_id,href,due_at,read_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)));

    if (isMigrationUnavailable(error)) {
      return { notifications: [], unavailable: true, error: null };
    }
    if (error) {
      return {
        notifications: [],
        unavailable: false,
        error: "Notifikasi belum dapat dimuat. Silakan coba kembali.",
      };
    }

    return {
      notifications: ((data ?? []) as NotificationRow[]).map(mapNotification),
      unavailable: false,
      error: null,
    };
  } catch {
    return {
      notifications: [],
      unavailable: false,
      error: "Notifikasi belum dapat dimuat. Periksa koneksi perangkat.",
    };
  }
}

export async function markOperationalNotificationsRead(
  notificationId: string | null = null,
): Promise<{ error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("mark_user_notifications_read", {
      target_notification_id: notificationId,
    });

    if (error) {
      return { error: "Status notifikasi belum dapat diperbarui." };
    }
    return { error: null };
  } catch {
    return { error: "Status notifikasi belum dapat diperbarui." };
  }
}
