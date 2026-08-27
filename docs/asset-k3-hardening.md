# Asset K3 Operational Hardening

## Tujuan

Phase ini mengubah modul aset dari katalog dasar menjadi register aset K3 yang
menyimpan identitas teknis, status operasional, jadwal inspeksi, kontrol
keselamatan, sertifikat/kalibrasi, work order, dan dokumen pendukung.

Risk scoring laporan dan checklist tetap memakai rumus deterministik:

```text
severity × probability × exposure
```

## Migration

File migration:

```text
supabase/migrations/010_asset_k3_operational_hardening.sql
```

Migration harus direview dan dijalankan manual melalui Supabase SQL Editor
setelah migration `009_advanced_hazard_reporting.sql`. Aplikasi yang memakai
field baru tidak boleh dideploy sebelum migration 010 berhasil.

Migration membuat bucket private:

```text
asset-documents
```

Format path objek:

```text
assets/{asset_uuid}/{random_uuid}-{file_name}
```

File yang didukung adalah PDF, JPG, PNG, dan WebP dengan batas 10 MB.

## Model Data

### Kolom tambahan `assets`

- produsen, model, nomor seri, tahun pembuatan, dan tanggal perolehan;
- spesifikasi teknis dalam JSON object;
- sumber energi dan kompetensi operator;
- referensi regulasi;
- interval inspeksi;
- status operasional;
- metadata isolasi/LOTO.

Status kelayakan tetap terpisah dari status operasional. Contoh:

- kondisi `perlu_dicek` dapat disertai status `penggunaan_dibatasi`;
- kondisi `tidak_layak` tidak boleh berstatus `aktif`;
- aset dalam perbaikan atau karantina wajib mempunyai alasan isolasi.

### Tabel terkait

- `asset_safety_controls`: guard, interlock, emergency stop, grounding,
  ventilasi, alarm, dan isolasi energi;
- `asset_certificates`: riksa uji, kalibrasi, izin operasi, masa berlaku, dan
  dokumen bukti;
- `asset_work_orders`: pemeliharaan preventif/korektif sampai verifikasi
  kembali beroperasi;
- `asset_documents`: manual, datasheet, foto, dan diagram;
- `asset_inspection_reviews`: rekomendasi perubahan kelayakan dari checklist
  yang harus ditinjau teknisi/admin.

## Sinkronisasi Checklist

Setelah seluruh `checklist_result_items` tersimpan dalam transaksi atomik:

1. `last_inspection_at` diperbarui dengan waktu checklist terbaru.
2. `next_inspection_at` dihitung dari `inspection_interval_days`.
3. Sistem membuat rekomendasi status:
   - item kritis bernilai `tidak` → `tidak_layak`;
   - item non-kritis bernilai `tidak` → `perlu_dicek`;
   - tanpa jawaban `tidak` → `layak`.
4. Rekomendasi tidak langsung mengubah status aset.
5. Teknisi/admin harus menerapkan atau menolak rekomendasi.
6. Rekomendasi `tidak_layak` yang diterapkan mengarantina aset.

Pola ini mencegah checklist lama atau kesalahan input langsung mengaktifkan atau
menonaktifkan aset tanpa review manusia.

## Role dan RLS

- Pengguna aktif dapat membaca data aset pada laboratorium yang dapat mereka
  akses.
- Admin dapat mengelola seluruh register aset.
- Teknisi hanya dapat mengelola aset pada laboratorium penugasannya.
- Mahasiswa, dosen, dan kepala laboratorium bersifat read-only pada kontrol
  tulis asset-management yang sudah ada.
- Semua write compliance menggunakan RPC `SECURITY DEFINER` dengan
  `SET search_path = ''` dan pemeriksaan `can_manage_asset_data()`.
- Tidak ada service-role key pada browser.
- Bucket dokumen bersifat private dan aksesnya mengikuti laboratorium aset.

## Referensi K3

Desain register mengacu pada kebutuhan pencatatan inspeksi, pemeliharaan,
perbaikan, sertifikat, penandaan peralatan tidak aman, dan penguncian dalam
PP Nomor 50 Tahun 2012. Klasifikasi rinci harus disesuaikan dengan jenis aset,
termasuk Permenaker Nomor 38 Tahun 2016, Permenaker Nomor 12 Tahun 2015,
Permenaker Nomor 5 Tahun 2018, dan Permenaker Nomor 15 Tahun 2008.

Permenaker Nomor 11 Tahun 2026 memperbarui tata cara pengawasan K3 dan perlu
dipertimbangkan saat menyusun prosedur riksa uji aktual. Modul ini membantu
pencatatan, tetapi tidak menggantikan pemeriksaan Ahli K3, PJK3, atau kewajiban
hukum sesuai klasifikasi peralatan.

## Runtime Test Wajib

1. Jalankan migration 010 melalui SQL Editor.
2. Login sebagai admin.
3. Buka `/assets/AST-001`.
4. Isi identitas teknis dan ubah status operasional ke `penggunaan_dibatasi`.
5. Tambahkan emergency stop dan grounding.
6. Tambahkan sertifikat riksa uji dengan file PDF kecil.
7. Pastikan file hanya dapat dibuka melalui signed URL setelah login.
8. Buat work order korektif dan ubah ke `dalam_pengerjaan`.
9. Pastikan aset berubah menjadi `dalam_perbaikan`.
10. Selesaikan work order dengan catatan verifikasi.
11. Isi checklist baru pada AST-001.
12. Pastikan tanggal inspeksi terakhir dan berikutnya diperbarui.
13. Pastikan rekomendasi status muncul dan tidak diterapkan otomatis.
14. Terapkan rekomendasi sebagai admin/teknisi.
15. Login sebagai mahasiswa dan pastikan seluruh kontrol tulis tidak tampil.
16. Pastikan aset lintas laboratorium tidak dapat dibaca/dikelola di luar RLS.

## SQL Verification

```sql
select code, status, operational_state, last_inspection_at,
       next_inspection_at, inspection_interval_days
from public.assets
order by code;

select asset_id, control_type, name, status
from public.asset_safety_controls;

select asset_id, certificate_type, certificate_number, expires_at
from public.asset_certificates;

select work_order_number, asset_id, status, return_to_service
from public.asset_work_orders;

select asset_id, recommended_status, review_status
from public.asset_inspection_reviews;
```

## Rollback

Migration ini bersifat additive. Jika UI perlu dikembalikan sementara:

1. rollback commit aplikasi tanpa menghapus data;
2. pertahankan tabel dan kolom baru agar bukti audit tidak hilang;
3. jangan `DROP TABLE` atau menghapus objek Storage sebelum data diekspor dan
   keputusan penghapusan disetujui;
4. jika migration gagal di dalam transaksi, PostgreSQL akan melakukan rollback
   otomatis sebelum `COMMIT`.
