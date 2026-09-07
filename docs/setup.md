# Setup Development dan Deployment

## Persyaratan

- Node.js versi LTS
- npm
- Project Supabase
- Browser modern dengan HTTPS untuk kamera

## Instalasi

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Environment minimum

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_STORAGE_BUCKET=report-evidence
```

Environment opsional:

```env
AI_PROVIDER=none
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=30000
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free

NEXT_PUBLIC_DEMO_MODE_ENABLED=false
DEMO_MODE_ENABLED=false
DEMO_ACCOUNT_PASSWORD=
```

`DEMO_ACCOUNT_PASSWORD` dan seluruh provider key harus disimpan sebagai secret server. Jangan menggunakan prefix `NEXT_PUBLIC_` untuk credential.

## Database

Jalankan migration melalui Supabase SQL Editor sesuai urutan nama file:

```text
001
002
004
005
006
007
008
009
010
011
012
013
014
015
```

Nomor `003` memang tidak digunakan. Setelah schema tersedia, jalankan `supabase/seed/001_seed_initial_data.sql` pada project demo bila membutuhkan data sintetis.

Migration harus dijalankan dengan database owner/admin context. Jangan menjalankan preflight atau verifikasi data menggunakan session aplikasi biasa karena RLS dapat menyembunyikan row.

## Storage

1. Buat bucket `report-evidence`.
2. Atur bucket menjadi private.
3. Pastikan policy migration telah diterapkan.
4. Uji upload dan signed URL dengan user authenticated yang memiliki akses report.

## Akun pertama

1. Buat user di Supabase Authentication.
2. Tambahkan row `user_profiles` dengan UUID user yang sama.
3. Isi role `admin`, `is_active=true`, dan `laboratory_id=null`.
4. Login dan verifikasi halaman admin sebelum membuat akun lain.

## Deployment Vercel

1. Hubungkan repository ke Vercel.
2. Tambahkan environment variable untuk Production dan Preview sesuai kebutuhan.
3. Jalankan production build.
4. Uji login, route guard, data Supabase, Storage, AI fallback, dan kamera melalui HTTPS.

Jangan commit `.env.local`, database dump, password, atau key production.
