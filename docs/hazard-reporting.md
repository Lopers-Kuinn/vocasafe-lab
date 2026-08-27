# Pelaporan Bahaya K3 VocaSafe Lab

## Tujuan

Form `/reports/new` digunakan untuk pencatatan internal kondisi tidak aman,
near miss, kecelakaan/cedera, kerusakan aset, kebakaran/ledakan, tumpahan
bahan, dan keluhan kesehatan terkait aktivitas laboratorium.

Form ini membantu identifikasi dan tindak lanjut internal. Form tidak
menggantikan kewajiban pelaporan kecelakaan kepada instansi yang berwenang.

## Perubahan Database

Jalankan migration berikut melalui Supabase SQL Editor sebelum menjalankan
source aplikasi yang menggunakan field baru:

```text
supabase/migrations/009_advanced_hazard_reporting.sql
```

Migration bersifat additive. Migration tidak menghapus data, tabel, policy,
atau helper RLS. Laporan lama memperoleh jenis `kondisi_tidak_aman`, kategori
`lainnya`, dan tetap memakai `reported_at` sebagai fallback waktu kejadian.

Field baru meliputi:

- jenis laporan;
- kategori bahaya;
- waktu ditemukan/terjadi;
- aktivitas saat kejadian;
- status bahaya masih aktif;
- tindakan sementara;
- pemberitahuan kepada laboran/PIC;
- orang terdampak dan kondisi/pertolongan;
- saksi;
- penanda kerahasiaan.

## Perilaku Form

- Aset bersifat opsional agar temuan area umum dapat dilaporkan.
- Laboratorium tetap wajib dan mengikuti akses RLS pengguna.
- Dampak, kemungkinan, dan paparan tidak memiliki nilai default.
- Risk score tetap dihitung sebagai `severity × probability × exposure`.
- AI hanya memberi saran kategori dan nilai risiko. Saran harus diterapkan atau
  ditinjau pengguna dan tidak disimpan sebagai metadata AI otomatis.
- Bahaya yang masih aktif menampilkan instruksi pengamanan segera.
- Maksimal tiga foto dapat dipilih; setiap file tetap dibatasi 5 MB.
- Kegagalan satu foto tidak menghapus laporan yang sudah berhasil disimpan.

## Privasi

Penanda laporan rahasia tidak membuat laporan anonim. Identitas reporter tetap
disimpan untuk verifikasi. Akses data tetap ditentukan oleh policy RLS laporan:
reporter membaca laporannya sendiri dan manager yang berwenang membaca laporan
sesuai cakupan laboratorium.

## Runtime Test Minimum

1. Buat laporan terkait `AST-001` dengan nilai 5 × 4 × 5 dan verifikasi skor
   100/kritis.
2. Buat laporan area umum tanpa aset dan pastikan laboratorium wajib dipilih.
3. Buat laporan bahaya aktif tanpa tindakan sementara dan pastikan validasi
   menolak submit.
4. Buat laporan dengan orang terdampak tanpa detail cedera dan pastikan validasi
   menolak submit.
5. Unggah tiga foto valid dan pastikan seluruh attachment tampil di detail.
6. Verifikasi jenis, kategori, waktu kejadian, pengamanan awal, dan informasi
   korban/saksi tampil di detail.
7. Verifikasi filter jenis/kategori dan pencarian pada `/reports`.
8. Verifikasi CSV audit memuat field laporan baru.

## Rollback

Rollback source dapat dilakukan dengan kembali ke checkpoint sebelum fitur ini.
Jika migration sudah diterapkan, jangan menghapus kolom sebelum memastikan tidak
ada data produksi yang perlu dipertahankan. Migration rollback harus dibuat
terpisah setelah backup dan review manual.
