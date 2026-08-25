# Arsitektur VocaSafe Lab

## Ringkasan

VocaSafe Lab adalah aplikasi Next.js App Router untuk audit K3 dan manajemen risiko laboratorium. Aplikasi menggunakan Supabase untuk autentikasi, PostgreSQL, Row Level Security (RLS), dan penyimpanan bukti laporan. Integrasi AI hanya tersedia melalui route handler server dan tetap memiliki fallback rule-based.

## Stack

- Next.js 16 App Router dan React 19
- TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, RLS, dan Storage
- `qrcode.react` dan `html5-qrcode`

## Batas arsitektur

```text
Browser UI
  ├── src/app dan src/components
  ├── src/lib/* client data services
  └── Supabase browser client (anon key + session cookie)

Next.js server boundary
  ├── src/proxy.ts: autentikasi dan route-role enforcement
  ├── src/app/api/*: server-only API handlers
  └── src/lib/supabase/server.ts: cookie-aware Supabase server client

Supabase
  ├── Auth
  ├── PostgreSQL + RLS sebagai otorisasi terakhir
  ├── RPC transaksi untuk workflow multi-tabel
  └── Storage untuk bukti laporan
```

Client-side role checks hanya mengatur pengalaman UI. Keamanan data wajib tetap ditegakkan oleh proxy/server boundary dan RLS.

## Otorisasi

Role canonical:

- `mahasiswa`
- `dosen`
- `teknisi`
- `kepala_lab`
- `admin`

Matriks route berada di `src/lib/role-access.ts` dan digunakan oleh UI serta `src/proxy.ts`. Perubahan status laporan dan penambahan tindak lanjut hanya diizinkan untuk `teknisi` dan `admin`. RLS tetap menjadi lapisan otorisasi terakhir untuk seluruh query browser.

## Workflow atomik

Workflow yang menulis lebih dari satu tabel harus menggunakan RPC PostgreSQL agar seluruh operasi berhasil atau seluruhnya dibatalkan:

- `save_report_followup_atomic`: memperbarui status laporan dan menambah riwayat tindak lanjut.
- `submit_checklist_result_atomic`: menyimpan hasil checklist dan seluruh jawaban item.

Definisi RPC berada di `supabase/migrations/007_atomic_workflows_and_report_roles.sql`.

## Risk scoring

Rumus canonical:

```text
Risk Score = Severity × Probability × Exposure
```

Setiap faktor berupa integer 1 sampai 5. Rentang skor dan kategori:

| Skor | Kategori |
|---:|---|
| 1–20 | Rendah |
| 21–50 | Sedang |
| 51–80 | Tinggi |
| 81–125 | Kritis |

Implementasi domain berada di `src/lib/risk-scoring.ts`. Constraint dan RLS database memverifikasi bahwa skor serta kategori yang disimpan sesuai dengan faktor input.

## AI recommendation

Endpoint `src/app/api/ai/risk-recommendation/route.ts` berjalan di server. Endpoint memverifikasi sesi, profil aktif, role, rate limit, dan input sebelum memanggil provider. Secret provider tidak boleh diekspos melalui environment variable `NEXT_PUBLIC_*`.

## Source of truth

1. Migration SQL untuk schema, transaksi, dan RLS.
2. `src/types/index.ts` untuk kontrak domain aplikasi.
3. `src/lib/role-access.ts` untuk matriks route dan hak edit UI/server.
4. `src/lib/risk-scoring.ts` untuk perhitungan risiko.

Perubahan pada aturan role atau workflow multi-tabel harus memperbarui semua lapisan terkait dan disertai pengujian lint, typecheck, build, route, role, serta RLS.
