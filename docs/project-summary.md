# Project Summary: VocaSafe Lab

## Masalah

Laboratorium vokasi memiliki banyak alat dan fasilitas yang digunakan oleh mahasiswa, dosen, teknisi, dan pengelola lab. Risiko K3 sering muncul dari alat yang tidak layak pakai, SOP yang tidak mudah diakses, laporan bahaya yang tidak terdokumentasi, dan tindak lanjut yang sulit dipantau.

Masalah utama yang ingin dijawab:

- Informasi alat dan SOP tidak selalu tersedia saat praktik berlangsung.
- Pelaporan bahaya sering tidak terstruktur.
- Tingkat risiko sulit diprioritaskan secara konsisten.
- Tindak lanjut teknisi perlu tercatat dan mudah dipantau.
- Kepala laboratorium membutuhkan ringkasan audit yang mudah dibaca.

## Solusi

VocaSafe Lab adalah prototype sistem audit K3 dan manajemen risiko laboratorium vokasi berbasis web. Sistem ini menghubungkan asset lab, SOP digital, QR Code, laporan bahaya, risk scoring, checklist K3, dan audit report dalam satu alur demo.

Solusi utama:

- Asset memiliki detail, status, SOP, dan QR Code.
- Pengguna dapat mensimulasikan scan QR untuk membuka detail asset.
- Mahasiswa/dosen/teknisi dapat membuat laporan bahaya.
- Risiko dihitung memakai severity x probability x exposure.
- Teknisi/admin dapat menindaklanjuti laporan dengan status dan catatan.
- Dosen/teknisi/admin dapat mengisi checklist K3.
- Kepala lab/admin dapat melihat audit report dan export CSV.

## Target Pengguna

- **Mahasiswa**: scan QR, melihat asset, melaporkan bahaya.
- **Dosen**: memantau asset, membuat laporan, mengisi checklist.
- **Teknisi/Laboran**: menindaklanjuti laporan, mengisi checklist, melihat audit.
- **Kepala Laboratorium**: memantau dashboard, laporan, dan audit report.
- **Admin**: mengelola akses user/data dasar dan melakukan tindak lanjut sesuai RLS.

## Fitur

- Login Supabase dengan role dari `user_profiles`
- Dashboard monitoring
- Data alat/fasilitas
- Detail asset + QR Code
- SOP digital
- Simulasi scan QR
- Form laporan bahaya
- Risk scoring severity x probability x exposure
- Daftar laporan
- Detail laporan
- Tindak lanjut laporan
- Checklist K3
- Risk finding pada checklist
- Audit report
- Export CSV
- Print / Save as PDF
- Role-based navigation dan route guard

## Teknologi

- Next.js App Router
- TypeScript
- Tailwind CSS
- qrcode.react
- lucide-react
- Supabase Auth, Database, Storage, dan RLS
- Dummy data/localStorage legacy (bukan sumber route D4)

## Alur Kerja

1. Pengguna login dengan akun Supabase; role aktif dibaca dari `user_profiles`.
2. Pengguna membuka dashboard untuk melihat kondisi risiko.
3. Pengguna melihat daftar asset dan membuka detail asset.
4. Detail asset menampilkan SOP digital dan QR Code.
5. Pengguna mensimulasikan scan QR untuk membuka asset.
6. Pengguna membuat laporan bahaya.
7. Sistem menghitung risiko dengan severity x probability x exposure.
8. Laporan tersimpan dan tampil di daftar laporan/dashboard/audit.
9. Teknisi/admin membuka laporan dan menambahkan tindak lanjut.
10. Dosen/teknisi/admin mengisi checklist K3.
11. Kepala lab/admin membuka audit report untuk rekap dan export.

## Keunggulan

- Alur end-to-end mudah dipahami untuk demo.
- Risk scoring transparan dan berbasis rumus sederhana.
- Role access sesuai kebutuhan pengguna laboratorium.
- QR Code dan SOP membantu akses informasi asset.
- Dashboard dan audit report mendukung pengambilan keputusan.
- Supabase menyediakan backend terpusat, Auth, RLS, dan Storage untuk demo production-like.
- Fallback rule-based dan input manual menjaga alur demo tetap dapat diuji saat provider eksternal tidak tersedia.

## Status dan Batasan Prototype

- Route D4 sudah memakai Supabase sebagai database production-like, Auth, RLS, dan Storage evidence.
- Provider AI production bersifat opsional dengan fallback rule-based.
- QR scanner kamera tersedia jika permission/perangkat mendukung; input manual tetap tersedia.
- Upload evidence memakai Supabase Storage private dan signed URL.
- Print audit memakai `window.print()` tanpa library PDF eksternal.
- Helper dummy/localStorage lama dipertahankan sebagai artefak kompatibilitas, bukan sumber route D4.

## Pengembangan Lanjutan

Tahap berikutnya yang dapat dikembangkan:

- Penyempurnaan operasional Supabase dan observability.
- Penyempurnaan QR scanner dan fallback input manual.
- Penyempurnaan evidence lifecycle pada private storage.
- Penyempurnaan AI-assisted recommendation untuk tindak lanjut risiko.
- Dashboard grafik/tren risiko lanjutan.
- Notifikasi untuk laporan kritis.
- Export audit report ke PDF production.
- Manajemen master data asset, SOP, user, dan checklist.
- Ekspansi multi-lab untuk lebih banyak jurusan atau kampus.
