# VocaSafe Lab

VocaSafe Lab adalah aplikasi web responsif untuk audit K3 dan manajemen risiko laboratorium vokasi. Sistem menghubungkan QR Code aset, status kelayakan, SOP digital, laporan bahaya, checklist inspeksi, tindak lanjut, dan audit dalam satu alur yang dapat ditelusuri.

Dikembangkan oleh **Scanara17 — Politeknik Negeri Samarinda** untuk KMIPN 2026.

## Fitur utama

- Autentikasi Supabase dan akses berdasarkan role.
- Isolasi data antar-laboratorium melalui Row Level Security.
- Data aset, fasilitas K3, PIC, SOP, QR Code, dan riwayat aktivitas.
- Pemindaian QR melalui kamera dengan input kode sebagai fallback.
- Safety Gate sebelum pengguna membuka detail atau memakai aset.
- Laporan bahaya dengan foto kamera/galeri dan penyimpanan private.
- Risk scoring deterministik: `severity × probability × exposure`.
- Saran penanganan berbantuan AI yang wajib ditinjau pengguna.
- Checklist K3, bukti temuan, dan navigasi mobile.
- Assignment, acknowledgement, tenggat, notifikasi, dan follow-up.
- Dashboard berdasarkan role serta audit yang dapat diekspor ke CSV dan print.
- Draft dan antrean sinkronisasi untuk koneksi lapangan yang tidak stabil.

## Role

| Role | Tanggung jawab utama |
|---|---|
| Mahasiswa | Memindai aset dan melaporkan bahaya |
| Dosen | Melakukan inspeksi dan checklist K3 |
| Teknisi/Laboran | Menangani laporan serta kondisi aset |
| Kepala Laboratorium | Memantau kondisi dan audit laboratorium |
| Admin | Mengelola sistem dan data dasar |

## Risk scoring

```text
Risk Score = Severity × Probability × Exposure
```

Masing-masing faktor bernilai 1–5.

| Skor | Kategori |
|---:|---|
| 1–20 | Rendah |
| 21–50 | Sedang |
| 51–80 | Tinggi |
| 81–125 | Kritis |

AI hanya memberikan saran kategori bahaya, faktor risiko, alasan singkat, dan rekomendasi awal. Nilai final tetap dipilih pengguna dan dihitung kembali oleh sistem.

## Teknologi

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, Row Level Security, dan Storage
- `html5-qrcode`
- `qrcode.react`
- Provider AI opsional dengan fallback rule-based

## Menjalankan aplikasi

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Di Windows PowerShell:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`.

Konfigurasi Supabase dan urutan migration tersedia di [docs/setup.md](docs/setup.md). Jangan commit `.env.local`, password, atau API key.

## Validasi

```bash
npm run typecheck
npm run lint
npm run build
```

Pengujian teknis mencakup role access, RLS lintas laboratorium, kamera QR, upload bukti private, laporan, checklist, sinkronisasi offline, follow-up, audit, CSV, dan print. Real-user testing tetap menjadi tahap validasi lapangan sebelum penggunaan operasional.

## Dokumentasi

- [Arsitektur](docs/architecture.md)
- [AI risk recommendation](docs/ai-recommendation.md)
- [Keamanan](docs/security.md)
- [Setup](docs/setup.md)
- [Pengujian](docs/testing.md)
- [Skenario demo](docs/demo-script.md)

## Batasan

VocaSafe Lab saat ini merupakan prototype tervalidasi secara teknis. Sistem tidak menggantikan inspeksi fisik, rambu keselamatan, prosedur LOTO, keputusan petugas K3, atau ketentuan institusi.
