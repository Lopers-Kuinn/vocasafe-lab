# VocaSafe Lab

VocaSafe Lab adalah prototype sistem audit K3 dan manajemen risiko laboratorium vokasi berbasis QR Code, Supabase, dan AI-assisted risk recommendation.

Status saat ini adalah **D4 production-like migration** untuk demo hackathon dan validasi alur kerja K3. Aplikasi sudah memakai Supabase Auth, Supabase Database, Supabase Storage, RLS hardening, QR camera scanner, dan AI recommendation fallback. Risk score utama tetap rule-based.

## Fitur Utama

- Supabase Auth dengan role dari tabel `user_profiles`
- Route guard berbasis role
- Dashboard monitoring dari data Supabase
- Data alat/fasilitas dan SOP dari Supabase
- Detail asset dengan SOP digital dan QR Code
- Scan QR manual dan camera-based QR scanner
- Form laporan bahaya dengan risk scoring
- Upload foto bukti ke Supabase Storage bucket private `report-evidence`
- Detail laporan dengan signed URL evidence
- Update status laporan dan tindak lanjut oleh role yang berwenang
- Checklist K3 dari template dan item Supabase
- Checklist dengan temuan risiko dan tanpa temuan risiko
- Audit report dari data Supabase
- Export CSV
- Print / Save as PDF via browser print
- Admin management page untuk user profiles dan data dasar
- AI-assisted recommendation provider-agnostic dengan fallback rule-based
- Login demo satu klik untuk lima role pada environment demo terkontrol

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Storage
- Row Level Security
- qrcode.react
- html5-qrcode
- lucide-react

## Role Aplikasi

- Mahasiswa
- Dosen
- Teknisi/Laboran
- Kepala Laboratorium
- Admin Sistem

## Hak Akses Route

| Route | Mahasiswa | Dosen | Teknisi | Kepala Lab | Admin |
|---|---:|---:|---:|---:|---:|
| `/dashboard` | Ya | Ya | Ya | Ya | Ya |
| `/scan` | Ya | Ya | Ya | Tidak | Ya |
| `/assets` | Ya | Ya | Ya | Ya | Ya |
| `/assets/[id]` | Ya | Ya | Ya | Ya | Ya |
| `/reports` | Ya | Ya | Ya | Ya | Ya |
| `/reports/new` | Ya | Ya | Ya | Tidak | Ya |
| `/reports/[id]` | Ya | Ya | Ya | Ya | Ya |
| `/checklists` | Tidak | Ya | Ya | Ya | Ya |
| `/checklists/new` | Tidak | Ya | Ya | Tidak | Ya |
| `/audit` | Tidak | Tidak | Ya | Ya | Ya |
| `/admin` | Tidak | Tidak | Tidak | Tidak | Ya |

## Hak Akses Operasional

- Mahasiswa dan dosen dapat membuat dan melihat laporan sesuai policy RLS.
- Teknisi, kepala laboratorium, dan admin dapat melihat laporan lintas user sesuai policy RLS.
- Teknisi pada laboratoriumnya dan admin dapat mengubah status laporan dan menambah tindak lanjut. Kepala laboratorium bersifat view-only untuk mutation laporan.
- Dosen, teknisi, dan admin dapat mengisi checklist.
- Kepala laboratorium dapat membaca hasil checklist untuk konteks audit, tetapi tidak mengisi checklist.
- Admin dapat melihat halaman `/admin` dan mengubah role/status user lain. Akun admin sendiri dilindungi dari self-demotion/self-deactivation.

## Status Laporan

Status laporan resmi:

- `baru`
- `diverifikasi`
- `dalam_penanganan`
- `selesai`
- `ditolak`

## Risk Scoring

Risk score utama selalu dihitung secara rule-based:

```text
Risk Score = Severity x Probability x Exposure
```

Setiap faktor bernilai integer 1 sampai 5.

Kategori risiko:

| Skor | Kategori |
|---:|---|
| 1-20 | rendah |
| 21-50 | sedang |
| 51-80 | tinggi |
| 81-125 | kritis |

Contoh:

```text
Severity = 5
Probability = 4
Exposure = 5
Risk Score = 5 x 4 x 5 = 100
Kategori = kritis
```

AI recommendation tidak menghitung ulang dan tidak mengganti risk score. Jika provider AI tidak tersedia, aplikasi memakai fallback rule-based.

## Cara Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka aplikasi di browser melalui URL yang ditampilkan Next.js, biasanya:

```text
http://localhost:3000
```

Validasi sebelum review atau deploy:

```bash
npm run typecheck
npm run build
```

`npm run lint` lulus pada pemeriksaan terakhir. Riwayat D4 pernah mencatat issue `react-hooks/set-state-in-effect` di `src/components/AppShell.tsx`; jalankan lint ulang setelah perubahan besar.

## Environment

Gunakan `.env.local` untuk development lokal dan jangan commit file tersebut.

Variabel utama:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_STORAGE_BUCKET=report-evidence
AI_PROVIDER=none
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
NEXT_PUBLIC_DEMO_MODE_ENABLED=false
DEMO_MODE_ENABLED=false
DEMO_ACCOUNT_PASSWORD=
```

Catatan:

- Secret AI key bersifat server-only.
- Jangan menaruh secret pada variabel `NEXT_PUBLIC_*`.
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai bila ada operasi server-only admin yang benar-benar membutuhkan, dan tidak boleh masuk Client Component.
- `DEMO_ACCOUNT_PASSWORD` bersifat server-only. Mode demo production harus tetap
  nonaktif kecuali menggunakan database khusus demo.

## Sumber Data D4

Untuk route D4 aktif, sumber utama adalah Supabase:

- Auth dan role: `auth.users` + `public.user_profiles`
- Asset/SOP/fasilitas K3: Supabase Database
- Reports/follow-up/attachments: Supabase Database
- Evidence image: Supabase Storage bucket private `report-evidence`
- Checklist templates/items/results: Supabase Database
- Dashboard/audit/admin summary: Supabase Database

File dummy dan helper localStorage lama masih ada sebagai artefak legacy/non-runtime, tetapi bukan sumber utama route D4 aktif.

## Setup Supabase Ringkas

Sebelum deploy ke environment baru:

1. Jalankan migration `supabase/migrations/001_initial_d4_schema.sql`.
2. Jalankan seed `supabase/seed/001_seed_initial_data.sql`.
3. Buat admin user pertama secara manual di Supabase Auth dan `public.user_profiles`.
4. Buat bucket private `report-evidence`.
5. Jalankan migration `supabase/migrations/002_d4_rls_hardening.sql`.
6. Jalankan migration `004` sampai `013` secara berurutan sesuai nomor file.
7. Pastikan bucket private `report-evidence`, `asset-documents`, dan
   `checklist-evidence` tersedia.
8. Pastikan policy RLS dan Storage sudah diuji untuk role utama.

Detail ada di:

- `docs/supabase-setup.md`
- `docs/supabase-storage.md`
- `docs/rls-hardening.md`
- `docs/deploy-preparation.md`

## Catatan Prototype

- Aplikasi sudah production-like untuk demo D4, tetapi belum diklaim production-ready penuh.
- RLS sudah diperketat pada D4-13, tetapi tetap perlu review lingkungan target sebelum production.
- Signed URL evidence memiliki masa berlaku terbatas.
- Export PDF memakai fitur browser Print / Save as PDF, bukan library PDF eksternal.
- AI-assisted recommendation harus direview manusia sebelum menjadi keputusan akhir.

## Dokumentasi Tambahan

- Deploy preparation: `docs/deploy-preparation.md`
- Supabase setup: `docs/supabase-setup.md`
- Supabase storage: `docs/supabase-storage.md`
- RLS hardening: `docs/rls-hardening.md`
- AI recommendation: `docs/ai-recommendation.md`
- Testing checklist: `docs/testing-checklist.md`
- Demo script: `docs/demo-script.md`
- Akun demo: `docs/demo-accounts.md`
