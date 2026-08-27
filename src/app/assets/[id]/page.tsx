"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Loader2,
  Pencil,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AssetActivitySection from "@/components/assets/AssetActivitySection";
import AssetFormModal from "@/components/assets/AssetFormModal";
import AssetQrActions from "@/components/assets/AssetQrActions";
import AssetSafetySection from "@/components/assets/AssetSafetySection";
import {
  fetchAssetContact,
  fetchAssetByLookup,
  fetchLaboratories,
  getAssetQrPayload,
  type AssetContactSummary,
  type DatabaseAsset,
  type DatabaseAssetKind,
  type DatabaseAssetStatus,
  type LaboratorySummary,
} from "@/lib/assets";
import { getCurrentUserProfile } from "@/lib/auth";
import { canManageAssetData } from "@/lib/role-access";
import type { AppUser } from "@/types";

const statusColors: Record<DatabaseAssetStatus, string> = {
  layak: "bg-green-100 text-green-800",
  perlu_dicek: "bg-amber-100 text-amber-800",
  tidak_layak: "bg-red-100 text-red-800",
};

const statusLabels: Record<DatabaseAssetStatus, string> = {
  layak: "Layak",
  perlu_dicek: "Perlu Dicek",
  tidak_layak: "Tidak Layak",
};

const kindLabels: Record<DatabaseAssetKind, string> = {
  alat: "Alat",
  fasilitas: "Fasilitas",
};

function formatDate(value: string | null): string {
  if (!value) return "Belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak valid";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(date);
}

function picRoleLabel(role: AssetContactSummary["picRole"]): string {
  if (role === "dosen") return "Dosen";
  if (role === "teknisi") return "Teknisi/Laboran";
  if (role === "kepala_lab") return "Kepala Laboratorium";
  return "";
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [asset, setAsset] = useState<DatabaseAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loadedRouteId, setLoadedRouteId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [contact, setContact] = useState<AssetContactSummary | null>(null);
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [supportError, setSupportError] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const currentRouteId = routeId ?? "";

  function loadSupportingData(loadedAsset: DatabaseAsset) {
    void Promise.all([
      fetchAssetContact(loadedAsset.id),
      fetchLaboratories(),
      getCurrentUserProfile(),
    ]).then(([contactResult, laboratoryResult, profileResult]) => {
      setContact(contactResult.contact);
      setLaboratories(laboratoryResult.laboratories);
      setCurrentUser(profileResult.user);
      setSupportError(
        [contactResult.error, laboratoryResult.error].filter(Boolean).join("; "),
      );
    });
  }

  function retryLoadAsset() {
    setLoading(true);
    setError("");
    setNotFound(false);
    void fetchAssetByLookup(currentRouteId).then((result) => {
      setAsset(result.asset);
      setError(result.error ?? "");
      setNotFound(!result.asset && !result.error);
      setLoadedRouteId(currentRouteId);
      setLoading(false);
      if (result.asset) loadSupportingData(result.asset);
    });
  }

  useEffect(() => {
    let active = true;

    void fetchAssetByLookup(currentRouteId).then((result) => {
      if (!active) return;
      setAsset(result.asset);
      setError(result.error ?? "");
      setNotFound(!result.asset && !result.error);
      setLoadedRouteId(currentRouteId);
      setLoading(false);
      if (result.asset) loadSupportingData(result.asset);
    });

    return () => {
      active = false;
    };
  }, [currentRouteId]);

  if (loading || loadedRouteId !== currentRouteId) {
    return (
      <AppShell>
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <div className="text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-emerald-600" />
            Memuat detail aset...
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div role="alert" className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <AlertTriangle className="h-8 w-8" />
          <h1 className="mt-3 text-lg font-semibold">Detail aset tidak dapat dimuat.</h1>
          <p className="mt-1 text-sm">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retryLoadAsset}
              className="inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm font-medium hover:bg-red-200"
            >
              <RefreshCw className="h-4 w-4" /> Coba Lagi
            </button>
            <Link
              href="/assets"
              className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium hover:bg-red-100"
            >
              Kembali ke Daftar Aset
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (notFound || !asset) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 text-xl font-bold text-slate-900">Aset tidak ditemukan</h1>
          <p className="mt-2 text-sm text-slate-500">
            Aset tidak ditemukan atau Anda tidak memiliki akses.
          </p>
          <Link
            href="/assets"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Aset
          </Link>
        </div>
      </AppShell>
    );
  }

  const qrPayload = getAssetQrPayload(asset);
  const canManage = currentUser
    ? canManageAssetData(
        currentUser.role,
        currentUser.laboratoryId,
        asset.laboratoryId,
      )
    : false;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/assets"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div id="sop-digital" className="min-w-0 scroll-mt-24 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-2xl font-bold text-slate-900">{asset.name}</h1>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowEditForm(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    aria-label="Edit detail aset"
                    title="Edit detail aset"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1 break-words text-slate-500">
                {asset.code} &middot; {asset.location || "Lokasi belum ditentukan"}
              </p>
              <span
                className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[asset.status]}`}
              >
                {statusLabels[asset.status]}
              </span>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-700">Jenis</dt>
              <dd className="mt-1 text-slate-600">{kindLabels[asset.kind]}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">PIC / Penanggung Jawab</dt>
              <dd className="mt-1 flex min-w-0 items-start gap-2 text-slate-600">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 break-words">
                  {contact?.picName
                    ? `${contact.picName}${contact.picRole ? ` · ${picRoleLabel(contact.picRole)}` : ""}`
                    : "Belum ditentukan"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Kontak Darurat Lab</dt>
              <dd className="mt-1 flex min-w-0 items-start gap-2 text-slate-600">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {contact?.emergencyContactPhone ? (
                  <a
                    href={`tel:${contact.emergencyContactPhone}`}
                    className="min-w-0 break-all hover:text-emerald-700 hover:underline"
                  >
                    {contact.emergencyContactName ?? "Kontak lab"}: {contact.emergencyContactPhone}
                  </a>
                ) : (
                  "Belum tersedia"
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Kategori</dt>
              <dd className="mt-1 break-words text-slate-600">{asset.category || "Belum tersedia"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Laboratorium</dt>
              <dd className="mt-1 break-words text-slate-600">
                {asset.laboratory
                  ? `${asset.laboratory.name} (${asset.laboratory.code})`
                  : "Belum terhubung"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Lokasi</dt>
              <dd className="mt-1 break-words text-slate-600">{asset.location || "Belum tersedia"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-700">Deskripsi</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-slate-600">{asset.description || "Belum tersedia"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Inspeksi Terakhir</dt>
              <dd className="mt-1 text-slate-600">{formatDate(asset.lastInspectionAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Inspeksi Berikutnya</dt>
              <dd className="mt-1 text-slate-600">{formatDate(asset.nextInspectionAt)}</dd>
            </div>
          </dl>

          {supportError && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Informasi PIC atau kontak belum dapat dimuat: {supportError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/reports/new?assetId=${encodeURIComponent(asset.code)}`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 min-[420px]:w-auto"
            >
              <AlertTriangle className="h-4 w-4" /> Laporkan Bahaya
            </Link>
          </div>
        </div>

        <AssetSafetySection
          asset={asset}
          canManage={canManage}
          onAssetUpdated={retryLoadAsset}
        />

        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">SOP Digital</h2>
          </div>

          {asset.sop ? (
            <>
              <h3 className="font-semibold text-slate-900">{asset.sop.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                Versi {asset.sop.version || "-"} &middot; Terakhir diperbarui{" "}
                {formatDate(asset.sop.lastUpdatedAt)}
              </p>

              <div className="mt-5">
                <p className="text-sm font-medium text-slate-700">APD yang diperlukan</p>
                {asset.sop.requiredPpe.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                    {asset.sop.requiredPpe.map((ppe) => (
                      <li key={ppe}>{ppe}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Tidak ada APD yang dicantumkan.</p>
                )}
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-slate-700">Langkah-langkah</p>
                {asset.sop.steps.length > 0 ? (
                  <ol className="mt-2 list-outside space-y-2 pl-5 text-sm text-slate-600">
                    {asset.sop.steps.map((step, index) => (
                      <li key={`${index}-${step}`} className="break-words pl-1">{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Langkah SOP belum tersedia.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Aset ini belum terhubung dengan SOP.</p>
          )}
        </div>

        <AssetQrActions
          asset={asset}
          payload={qrPayload}
          contact={contact}
          canManage={canManage}
        />

        <AssetActivitySection assetId={asset.id} canManage={canManage} />
      </div>

      {showEditForm && currentUser && (
        <AssetFormModal
          key={`edit-${asset.id}`}
          asset={asset}
          contact={contact}
          currentUser={currentUser}
          laboratories={laboratories}
          onClose={() => setShowEditForm(false)}
          onSaved={(assetId) => {
            setShowEditForm(false);
            void fetchAssetByLookup(assetId).then((result) => {
              if (!result.asset) {
                setError(result.error ?? "Aset yang diperbarui tidak dapat dimuat.");
                return;
              }
              setAsset(result.asset);
              loadSupportingData(result.asset);
              router.replace(`/assets/${encodeURIComponent(result.asset.code)}`);
            });
          }}
        />
      )}
    </AppShell>
  );
}
