# Arsitektur VocaSafe Lab

## Gambaran umum

```text
Browser
  ├─ Next.js responsive interface
  ├─ Camera QR and image capture
  └─ IndexedDB draft/outbox
          │
          ▼
Next.js route handlers
  ├─ Demo login
  └─ AI risk recommendation
          │
          ▼
Supabase
  ├─ Authentication
  ├─ PostgreSQL + RLS
  └─ Private evidence storage
```

## Lapisan aplikasi

- `src/app` berisi route dan halaman App Router.
- `src/components` berisi komponen layout, mobile, aset, dan scanner.
- `src/lib` berisi akses data, aturan risiko, sinkronisasi, notifikasi, AI, dan Supabase client.
- `src/types` berisi tipe domain bersama.
- `supabase/migrations` menyimpan schema, policy, constraint, dan RPC secara berurutan.

## Alur data utama

1. Supabase Auth memberikan session pengguna.
2. `user_profiles` menentukan role, status aktif, dan laboratorium.
3. RLS memeriksa akses pada database dan Storage.
4. Halaman membaca serta mengubah data melalui Supabase client pengguna.
5. Laporan dan checklist memvalidasi skor risiko di aplikasi dan database.
6. Bukti disimpan dalam bucket private dan ditampilkan melalui signed URL.
7. Saat offline, submission menggunakan ID tetap dan disinkronkan secara idempotent.

## Keputusan desain

- Risk score selalu deterministik dan tidak bergantung pada provider AI.
- QR membuka Safety Gate sebelum detail aset.
- Input kode tetap tersedia ketika kamera tidak dapat digunakan.
- Akses dibatasi pada database, bukan hanya dengan menyembunyikan tombol UI.
- Service-role key tidak digunakan oleh Client Component.
- Background polling berhenti ketika tab tersembunyi atau perangkat offline.

## Deployment

Next.js dapat dijalankan di Vercel. Supabase menyediakan Auth, Database, dan Storage. Environment variable public hanya berisi URL serta publishable key; credential istimewa dan provider key tetap berada di server.
