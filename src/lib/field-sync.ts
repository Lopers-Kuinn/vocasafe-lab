"use client";

import type { CreateChecklistResultInput } from "@/lib/checklists";
import { createChecklistResult } from "@/lib/checklists";
import { uploadChecklistEvidence } from "@/lib/checklist-v2";
import type { CreateReportInput } from "@/lib/reports";
import { createReport, uploadReportEvidence } from "@/lib/reports";
import { getReportEvidenceBucket } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DB_NAME = "vocasafe-field-v1";
const DB_VERSION = 1;
const DRAFT_STORE = "draft-evidence";
const OUTBOX_STORE = "outbox";
const SYNC_EVENT = "vocasafe-field-sync-change";

export interface ReportEvidenceDraft {
  id: string;
  file: File;
}

export interface ChecklistEvidenceDraft {
  id: string;
  itemId: string;
  file: File;
  measurementValue: number | null;
}

interface BaseOutboxEntry {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  completedEvidenceIds: string[];
}

interface ReportOutboxEntry extends BaseOutboxEntry {
  kind: "report";
  input: CreateReportInput;
  evidence: ReportEvidenceDraft[];
}

interface ChecklistOutboxEntry extends BaseOutboxEntry {
  kind: "checklist";
  input: CreateChecklistResultInput;
  evidence: ChecklistEvidenceDraft[];
  remoteResultId: string | null;
}

type FieldOutboxEntry = ReportOutboxEntry | ChecklistOutboxEntry;

export interface FieldSyncSnapshot {
  pending: number;
  failed: number;
  syncing: boolean;
  lastError: string | null;
}

let syncSnapshot: FieldSyncSnapshot = {
  pending: 0,
  failed: 0,
  syncing: false,
  lastError: null,
};
const SERVER_SYNC_SNAPSHOT: FieldSyncSnapshot = {
  pending: 0,
  failed: 0,
  syncing: false,
  lastError: null,
};
let processingPromise: Promise<void> | null = null;

function emitSyncChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Penyimpanan lokal tidak tersedia."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE);
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runStoreRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("Data lokal gagal diproses."));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Transaksi lokal gagal."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Transaksi lokal dibatalkan."));
    };
  });
}

async function currentOwnerId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function draftKey(scope: "report" | "checklist"): Promise<string | null> {
  const ownerId = await currentOwnerId();
  return ownerId ? `${ownerId}:${scope}` : null;
}

export async function saveReportDraftEvidence(files: File[]): Promise<void> {
  const key = await draftKey("report");
  if (!key) return;
  await runStoreRequest(DRAFT_STORE, "readwrite", (store) => store.put(files, key));
}

export async function loadReportDraftEvidence(): Promise<File[]> {
  try {
    const key = await draftKey("report");
    if (!key) return [];
    return (await runStoreRequest<File[] | undefined>(DRAFT_STORE, "readonly", (store) => store.get(key))) ?? [];
  } catch {
    return [];
  }
}

export async function clearReportDraftEvidence(): Promise<void> {
  try {
    const key = await draftKey("report");
    if (!key) return;
    await runStoreRequest(DRAFT_STORE, "readwrite", (store) => store.delete(key));
  } catch {
    // A saved remote result must not be treated as failed because local cleanup failed.
  }
}

export async function saveChecklistDraftEvidence(
  files: Record<string, File | null>,
): Promise<void> {
  const key = await draftKey("checklist");
  if (!key) return;
  await runStoreRequest(DRAFT_STORE, "readwrite", (store) => store.put(files, key));
}

export async function loadChecklistDraftEvidence(): Promise<Record<string, File | null>> {
  try {
    const key = await draftKey("checklist");
    if (!key) return {};
    return (await runStoreRequest<Record<string, File | null> | undefined>(DRAFT_STORE, "readonly", (store) => store.get(key))) ?? {};
  } catch {
    return {};
  }
}

export async function clearChecklistDraftEvidence(): Promise<void> {
  try {
    const key = await draftKey("checklist");
    if (!key) return;
    await runStoreRequest(DRAFT_STORE, "readwrite", (store) => store.delete(key));
  } catch {
    // A saved remote result must not be treated as failed because local cleanup failed.
  }
}

export function prepareReportEvidence(files: File[]): ReportEvidenceDraft[] {
  return files.map((file) => ({ id: crypto.randomUUID(), file }));
}

export function prepareChecklistEvidence(
  files: Record<string, File | null>,
  measurements: Record<string, string>,
): ChecklistEvidenceDraft[] {
  return Object.entries(files).flatMap(([itemId, file]) => {
    if (!file) return [];
    const measurement = Number(measurements[itemId]);
    return [{
      id: crypto.randomUUID(),
      itemId,
      file,
      measurementValue:
        Number.isFinite(measurement) && measurements[itemId] !== "" ? measurement : null,
    }];
  });
}

async function putOutbox(entry: FieldOutboxEntry): Promise<void> {
  await runStoreRequest(OUTBOX_STORE, "readwrite", (store) => store.put(entry));
  await refreshFieldSyncSnapshot();
}

export async function queueReportSubmission(
  input: CreateReportInput,
  evidence: ReportEvidenceDraft[],
  completedEvidenceIds: string[] = [],
): Promise<void> {
  const ownerId = await currentOwnerId();
  if (!ownerId) throw new Error("Sesi pengguna tidak tersedia untuk menyimpan antrean.");
  const now = new Date().toISOString();
  await putOutbox({
    id: input.submissionId,
    ownerId,
    kind: "report",
    input,
    evidence,
    completedEvidenceIds,
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function queueChecklistSubmission(
  input: CreateChecklistResultInput,
  evidence: ChecklistEvidenceDraft[],
  completedEvidenceIds: string[] = [],
  remoteResultId: string | null = null,
): Promise<void> {
  const ownerId = await currentOwnerId();
  if (!ownerId) throw new Error("Sesi pengguna tidak tersedia untuk menyimpan antrean.");
  const now = new Date().toISOString();
  await putOutbox({
    id: input.submissionId,
    ownerId,
    kind: "checklist",
    input,
    evidence,
    remoteResultId,
    completedEvidenceIds,
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function allOutbox(): Promise<FieldOutboxEntry[]> {
  return await runStoreRequest<FieldOutboxEntry[]>(OUTBOX_STORE, "readonly", (store) => store.getAll());
}

async function removeOutbox(id: string): Promise<void> {
  await runStoreRequest(OUTBOX_STORE, "readwrite", (store) => store.delete(id));
}

function safeSyncError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Data lapangan belum berhasil disinkronkan.";
}

async function processReport(entry: ReportOutboxEntry): Promise<void> {
  const result = await createReport(entry.input);
  if (result.error || !result.report || !result.reporterId) {
    throw new Error(result.error ?? "Laporan belum berhasil disimpan.");
  }

  if (entry.evidence.length === 0) return;
  const bucketResult = await getReportEvidenceBucket();
  if (bucketResult.error || !bucketResult.bucket) {
    throw new Error(bucketResult.error ?? "Storage bukti laporan belum tersedia.");
  }

  for (const evidence of entry.evidence) {
    if (entry.completedEvidenceIds.includes(evidence.id)) continue;
    const upload = await uploadReportEvidence({
      reportId: result.report.id,
      reporterId: result.reporterId,
      bucket: bucketResult.bucket,
      file: evidence.file,
      evidenceId: evidence.id,
    });
    if (upload.error) throw new Error(upload.error);
    entry.completedEvidenceIds.push(evidence.id);
    entry.updatedAt = new Date().toISOString();
    await putOutbox(entry);
  }
}

async function processChecklist(entry: ChecklistOutboxEntry): Promise<void> {
  let resultId = entry.remoteResultId;
  if (!resultId) {
    const result = await createChecklistResult(entry.input, { requireIdempotency: true });
    if (!result.resultSaved || !result.resultId) {
      throw new Error(result.error ?? "Checklist belum berhasil disimpan.");
    }
    resultId = result.resultId;
    entry.remoteResultId = resultId;
    entry.updatedAt = new Date().toISOString();
    await putOutbox(entry);
  }

  for (const evidence of entry.evidence) {
    if (entry.completedEvidenceIds.includes(evidence.id)) continue;
    const upload = await uploadChecklistEvidence(
      resultId,
      evidence.itemId,
      evidence.file,
      evidence.measurementValue,
      evidence.id,
    );
    if (upload.error) throw new Error(upload.error);
    entry.completedEvidenceIds.push(evidence.id);
    entry.updatedAt = new Date().toISOString();
    await putOutbox(entry);
  }
}

export async function refreshFieldSyncSnapshot(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const ownerId = await currentOwnerId();
    const entries = ownerId ? (await allOutbox()).filter((entry) => entry.ownerId === ownerId) : [];
    syncSnapshot = {
      ...syncSnapshot,
      pending: entries.length,
      failed: entries.filter((entry) => entry.lastError !== null).length,
      lastError: entries.find((entry) => entry.lastError)?.lastError ?? null,
    };
    emitSyncChange();
  } catch {
    syncSnapshot = { ...syncSnapshot, lastError: "Status sinkronisasi lokal tidak dapat dibaca." };
    emitSyncChange();
  }
}

export function subscribeFieldSync(onStoreChange: () => void): () => void {
  window.addEventListener(SYNC_EVENT, onStoreChange);
  return () => window.removeEventListener(SYNC_EVENT, onStoreChange);
}

export function getFieldSyncSnapshot(): FieldSyncSnapshot {
  return syncSnapshot;
}

export function getServerFieldSyncSnapshot(): FieldSyncSnapshot {
  return SERVER_SYNC_SNAPSHOT;
}

export function processFieldOutbox(force = false): Promise<void> {
  if (processingPromise) return processingPromise;
  processingPromise = (async () => {
    if (!navigator.onLine || !window.indexedDB) return;
    const ownerId = await currentOwnerId();
    if (!ownerId) return;
    syncSnapshot = { ...syncSnapshot, syncing: true };
    emitSyncChange();

    const entries = (await allOutbox())
      .filter((entry) => entry.ownerId === ownerId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    for (const entry of entries) {
      if (!force && entry.nextAttemptAt > Date.now()) continue;
      try {
        if (entry.kind === "report") await processReport(entry);
        else await processChecklist(entry);
        await removeOutbox(entry.id);
      } catch (error) {
        entry.attempts += 1;
        entry.lastError = safeSyncError(error);
        entry.nextAttemptAt = Date.now() + Math.min(300_000, 5_000 * 2 ** Math.min(entry.attempts, 6));
        entry.updatedAt = new Date().toISOString();
        await putOutbox(entry);
      }
    }
  })().catch((error) => {
    syncSnapshot = { ...syncSnapshot, lastError: safeSyncError(error) };
  }).finally(async () => {
    syncSnapshot = { ...syncSnapshot, syncing: false };
    processingPromise = null;
    await refreshFieldSyncSnapshot();
  });
  return processingPromise;
}

export async function retryFieldOutbox(): Promise<void> {
  try {
    const ownerId = await currentOwnerId();
    if (!ownerId) return;
    const entries = (await allOutbox()).filter((entry) => entry.ownerId === ownerId);
    await Promise.all(entries.map((entry) => putOutbox({ ...entry, nextAttemptAt: 0 })));
    await processFieldOutbox(true);
  } catch (error) {
    syncSnapshot = { ...syncSnapshot, lastError: safeSyncError(error) };
    emitSyncChange();
  }
}

export function isRetryableFieldError(message: string | null): boolean {
  if (!message) return false;
  return /fetch|network|koneksi|timeout|timed out|load failed|offline/i.test(message);
}
