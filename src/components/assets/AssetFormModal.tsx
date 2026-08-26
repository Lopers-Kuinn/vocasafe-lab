"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Save, X } from "lucide-react";
import {
  fetchAssetPicCandidates,
  saveAssetRecord,
  type AssetContactSummary,
  type AssetPicCandidate,
  type DatabaseAsset,
  type DatabaseAssetKind,
  type DatabaseAssetStatus,
  type LaboratorySummary,
} from "@/lib/assets";
import type { AppUser } from "@/types";

interface AssetFormModalProps {
  asset?: DatabaseAsset | null;
  contact?: AssetContactSummary | null;
  currentUser: AppUser;
  laboratories: LaboratorySummary[];
  onClose: () => void;
  onSaved: (assetId: string) => void;
}

const roleLabels: Record<AssetPicCandidate["role"], string> = {
  dosen: "Dosen",
  teknisi: "Teknisi/Laboran",
  kepala_lab: "Kepala Laboratorium",
};

function dateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AssetFormModal({
  asset = null,
  contact = null,
  currentUser,
  laboratories,
  onClose,
  onSaved,
}: AssetFormModalProps) {
  const isEditing = Boolean(asset);
  const initialLaboratoryId =
    asset?.laboratoryId ??
    (currentUser.role === "teknisi" ? currentUser.laboratoryId ?? "" : laboratories[0]?.id ?? "");

  const [laboratoryId, setLaboratoryId] = useState(initialLaboratoryId);
  const [name, setName] = useState(asset?.name ?? "");
  const [code, setCode] = useState(asset?.code ?? "");
  const [kind, setKind] = useState<DatabaseAssetKind>(asset?.kind ?? "alat");
  const [category, setCategory] = useState(asset?.category ?? "");
  const [location, setLocation] = useState(asset?.location ?? "");
  const [description, setDescription] = useState(asset?.description ?? "");
  const [status, setStatus] = useState<DatabaseAssetStatus>(asset?.status ?? "layak");
  const [picUserId, setPicUserId] = useState(contact?.picUserId ?? "");
  const [nextInspectionAt, setNextInspectionAt] = useState(
    dateInputValue(asset?.nextInspectionAt),
  );
  const [updateSop, setUpdateSop] = useState(false);
  const [sopTitle, setSopTitle] = useState(asset?.sop?.title ?? "");
  const [sopVersion, setSopVersion] = useState(asset?.sop?.version ?? "");
  const [sopPpe, setSopPpe] = useState(asset?.sop?.requiredPpe.join(", ") ?? "");
  const [sopSteps, setSopSteps] = useState(asset?.sop?.steps.join("\n") ?? "");
  const [emergencyName, setEmergencyName] = useState(contact?.emergencyContactName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(contact?.emergencyContactPhone ?? "");
  const [candidates, setCandidates] = useState<AssetPicCandidate[]>([]);
  const [candidateError, setCandidateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!laboratoryId) return;

    void fetchAssetPicCandidates(laboratoryId).then((result) => {
      if (!active) return;
      setCandidates(result.candidates);
      setCandidateError(result.error ?? "");
    });

    return () => {
      active = false;
    };
  }, [laboratoryId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!laboratoryId) {
      setError("Pilih laboratorium terlebih dahulu.");
      return;
    }
    if (!name.trim() || !code.trim()) {
      setError("Nama dan kode aset wajib diisi.");
      return;
    }
    if (updateSop && !sopTitle.trim()) {
      setError("Judul SOP wajib diisi ketika perubahan SOP diaktifkan.");
      return;
    }

    setSaving(true);
    const result = await saveAssetRecord({
      assetId: asset?.id ?? null,
      laboratoryId,
      code,
      name,
      kind,
      category,
      location,
      description,
      status,
      picUserId: picUserId || null,
      nextInspectionAt: toIsoDate(nextInspectionAt),
      updateSop: isEditing && updateSop,
      sopTitle,
      sopVersion,
      sopRequiredPpe: sopPpe
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      sopSteps: sopSteps
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      updateLaboratoryContact: isEditing,
      emergencyContactName: emergencyName,
      emergencyContactPhone: emergencyPhone,
    });
    setSaving(false);

    if (result.error || !result.assetId) {
      setError(result.error ?? "Data aset gagal disimpan.");
      return;
    }

    onSaved(result.assetId);
  }

  const technicianLocked = currentUser.role === "teknisi";

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex min-w-0 items-end justify-center overflow-hidden bg-slate-950/45 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-form-title"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {isEditing ? "Pembaruan terkontrol" : "Inventaris laboratorium"}
            </p>
            <h2 id="asset-form-title" className="mt-1 text-xl font-bold text-slate-900">
              {isEditing ? "Edit Detail Aset" : "Tambah Aset"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Tutup formulir aset"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Laboratorium</span>
              <select
                value={laboratoryId}
                onChange={(event) => {
                  setLaboratoryId(event.target.value);
                  setPicUserId("");
                }}
                disabled={isEditing || technicianLocked}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                required
              >
                <option value="">Pilih laboratorium</option>
                {laboratories.map((laboratory) => (
                  <option key={laboratory.id} value={laboratory.id}>
                    {laboratory.name} ({laboratory.code})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama aset</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Kode unik</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm uppercase"
                placeholder="AST-004"
                required
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Jenis</span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as DatabaseAssetKind)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="alat">Alat</option>
                <option value="fasilitas">Fasilitas</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Kategori</span>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Mesin produksi, APAR, P3K..."
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Lokasi penempatan</span>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Area praktik / ruang mesin"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Status kelayakan</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as DatabaseAssetStatus)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="layak">Layak</option>
                <option value="perlu_dicek">Perlu dicek</option>
                <option value="tidak_layak">Tidak layak</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">PIC utama</span>
              <select
                value={picUserId}
                onChange={(event) => setPicUserId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Belum ditentukan</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} — {roleLabels[candidate.role]}
                  </option>
                ))}
              </select>
              {candidateError && <span className="mt-1 block text-xs text-red-600">{candidateError}</span>}
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Jadwal inspeksi berikutnya
              </span>
              <input
                type="date"
                value={nextInspectionAt}
                onChange={(event) => setNextInspectionAt(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Deskripsi</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {isEditing && (
            <>
              <fieldset className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                <legend className="px-2 text-sm font-semibold text-slate-800">Kontak darurat lab</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Nama/unit kontak</span>
                    <input
                      value={emergencyName}
                      onChange={(event) => setEmergencyName(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Nomor kontak</span>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(event) => setEmergencyPhone(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="min-w-0 rounded-2xl border border-slate-200 p-3 sm:p-4">
                <legend className="px-2 text-sm font-semibold text-slate-800">SOP digital</legend>
                <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={updateSop}
                    onChange={(event) => setUpdateSop(event.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Perbarui SOP saat menyimpan. Jika SOP dipakai aset lain, sistem membuat salinan
                    khusus agar aset lain tidak berubah.
                  </span>
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Judul SOP</span>
                    <input
                      value={sopTitle}
                      onChange={(event) => setSopTitle(event.target.value)}
                      disabled={!updateSop}
                      className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Versi</span>
                    <input
                      value={sopVersion}
                      onChange={(event) => setSopVersion(event.target.value)}
                      disabled={!updateSop}
                      className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      APD (pisahkan dengan koma)
                    </span>
                    <input
                      value={sopPpe}
                      onChange={(event) => setSopPpe(event.target.value)}
                      disabled={!updateSop}
                      className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      Langkah SOP (satu langkah per baris)
                    </span>
                    <textarea
                      value={sopSteps}
                      onChange={(event) => setSopSteps(event.target.value)}
                      disabled={!updateSop}
                      rows={6}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>
                </div>
              </fieldset>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.05)] sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Menyimpan..." : "Simpan Aset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(modal, document.body);
}
