# Checklist K3 V2

Checklist K3 V2 memperkuat checklist lama menjadi alur inspeksi yang dapat
ditelusuri dan ditindaklanjuti. Risk score tetap dihitung secara deterministik:

`severity × probability × exposure`

AI tidak menentukan kelayakan aset dan tidak mengubah hasil inspeksi.

## Perubahan utama

- Snapshot judul/versi template dan item pada hasil inspeksi.
- Pernyataan pemeriksa sebelum submit.
- Foto bukti privat untuk temuan kritis, maksimal 5 MB (JPG/PNG/WebP).
- Dukungan metadata pengukuran untuk template teknis.
- Detail hasil di `/checklists/[id]`.
- Tindakan korektif dengan hierarchy of controls, PIC, tenggat, status,
  catatan penyelesaian, dan verifikasi.
- Kepala laboratorium dapat melihat hasil dan mengelola tindakan pada labnya,
  tetapi tidak mengisi checklist teknis.
- Rekomendasi status aset mempertimbangkan jawaban item dan kategori risiko.

## Aturan rekomendasi status aset

- Item kritis gagal atau risiko kritis: `tidak_layak`.
- Item gagal atau terdapat temuan risiko lain: `perlu_dicek`.
- Tidak ada kegagalan dan tidak ada temuan: `layak`.

Rekomendasi masuk ke `asset_inspection_reviews`; perubahan status aset tetap
memerlukan review pengelola yang berwenang.

## Tindakan korektif

Urutan kontrol yang dipilih mengikuti hierarchy of controls:

1. Eliminasi.
2. Substitusi.
3. Rekayasa teknik.
4. Administratif.
5. APD.

Status `selesai` berarti pengelola berwenang telah memverifikasi penyelesaian,
bukan sekadar PIC menyatakan pekerjaan selesai.

## Migration

Jalankan melalui Supabase SQL Editor setelah memastikan migration `010` dan
`011` telah diterapkan:

`supabase/migrations/012_checklist_k3_v2.sql`

Migration membuat bucket privat `checklist-evidence`. Jangan membuat bucket
menjadi public dan jangan menambahkan policy authenticated yang longgar.

Migration belum dijalankan otomatis oleh aplikasi atau proses build.

## Runtime test minimum

1. Dosen/teknisi/admin mengisi checklist tanpa temuan.
2. Dosen/teknisi/admin mengisi checklist dengan item kritis gagal dan foto.
3. Nilai 5 × 4 × 5 menghasilkan 100/kritis.
4. Hasil kritis merekomendasikan aset `tidak_layak`.
5. Bukti tampil melalui signed URL di detail.
6. Kepala lab dapat membuka daftar/detail, tetapi tidak `/checklists/new`.
7. Kepala lab/teknisi/admin lab yang sesuai dapat membuat tindakan korektif.
8. PIC, tenggat, status, completion note, dan verifikasi tetap tampil setelah reload.
9. Pengguna lintas laboratorium tidak dapat membaca atau mengubah data.
