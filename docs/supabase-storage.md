# Supabase Storage untuk Foto Bukti Laporan

D4 memakai bucket private `report-evidence` untuk foto bukti laporan. Upload dilakukan oleh pengguna yang sedang login melalui Supabase browser client sehingga operasi tetap melewati RLS. Preview pada detail laporan memakai signed URL dengan masa berlaku terbatas.

## Status Policy Saat Ini

Policy MVP luas dari D4-8 bukan policy final. Pada D4-13, migration `supabase/migrations/002_d4_rls_hardening.sql` memperketat akses Storage dan attachment metadata.

Rujukan final untuk policy Storage adalah:

- `supabase/migrations/002_d4_rls_hardening.sql`
- `docs/rls-hardening.md`

Migration 002 juga harus men-drop policy manual lama berikut jika masih ada di project Supabase:

- `report_evidence_authenticated_upload`
- `report_evidence_authenticated_read`

Tujuannya agar policy lama yang hanya memeriksa user authenticated tidak tetap memberi akses luas setelah hardening.

## Environment

Tambahkan ke `.env.local` dan environment deployment:

```env
SUPABASE_STORAGE_BUCKET=report-evidence
```

Nama bucket bukan secret. Service role key tidak digunakan oleh client upload/read flow.

## Membuat Bucket

Cara paling sederhana adalah melalui Supabase Dashboard:

1. Buka **Storage**.
2. Pilih **New bucket**.
3. Gunakan nama `report-evidence`.
4. Biarkan **Public bucket** tidak aktif.
5. Atur batas file `5 MB` jika opsi tersedia.
6. Batasi MIME type ke `image/jpeg`, `image/png`, dan `image/webp` jika opsi tersedia.

Bucket juga dapat dibuat manual melalui SQL Editor:

```sql
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'report-evidence',
  'report-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

## Kontrak Path Evidence

Upload evidence memakai pola path:

```text
reports/{reportId}/{timestamp}-{safeFileName}
```

Policy D4-13 memvalidasi bucket, pola path, kepemilikan/akses laporan, dan ekstensi file yang diizinkan. Jangan mengubah pola path tanpa meninjau ulang policy RLS dan Storage.

## Metadata Attachment

Setiap object evidence harus memiliki metadata di tabel:

```text
public.report_attachments
```

Kolom yang dipakai oleh aplikasi dan policy D4-13:

- `report_id`
- `uploaded_by`
- `bucket`
- `path`

Detail laporan membuat signed URL dari metadata tersebut. Signed URL yang sudah diterbitkan tetap berlaku sampai masa berlakunya habis.

## Riwayat Policy MVP D4-8

Pada D4-8 pernah ada policy minimum untuk mempercepat validasi upload/read bagi semua user authenticated. Policy tersebut sengaja luas dan hanya cocok untuk tahap MVP.

Untuk kondisi D4 sekarang:

- Jangan memakai policy MVP D4-8 sebagai policy final.
- Jangan membuat policy manual baru yang lebih longgar dari migration 002.
- Pastikan policy lama `report_evidence_authenticated_upload/read` sudah di-drop oleh migration 002.
- Gunakan D4-13 sebagai rujukan final.

## Verifikasi Manual

1. Login sebagai user yang berhak membuat laporan.
2. Buka `/reports/new?assetId=AST-001`.
3. Pilih foto JPG/PNG/WebP di bawah 5 MB lalu kirim laporan.
4. Pastikan row baru tersedia di `public.reports`.
5. Pastikan object tersedia pada path `reports/{reportId}/{timestamp}-{safeFileName}` di bucket private `report-evidence`.
6. Pastikan metadata tersedia di `public.report_attachments`.
7. Buka `/reports/{reportId}` dan pastikan signed URL menampilkan foto.
8. Login sebagai reporter atau report manager dan pastikan evidence tampil.
9. Login sebagai role yang tidak berhak membaca laporan tersebut dan pastikan akses ditolak oleh RLS.

Jika laporan berhasil dibuat tetapi upload atau metadata gagal, UI menampilkan peringatan tanpa membuat aplikasi crash. Object orphan akibat metadata gagal perlu dibersihkan secara administratif karena policy delete Storage tidak dibuka untuk client.

## Dokumen Aset K3

Migration `010_asset_k3_operational_hardening.sql` menambahkan bucket private
terpisah bernama `asset-documents`. Bucket dibuat oleh migration dengan batas
10 MB dan MIME type PDF, JPG, PNG, serta WebP.

Kontrak path:

```text
assets/{assetId}/{randomUuid}-{safeFileName}
```

Metadata dokumen umum disimpan pada `public.asset_documents`. Dokumen yang
melekat pada riksa uji atau kalibrasi disimpan pada
`public.asset_certificates`. Akses baca mengikuti laboratorium aset, sedangkan
upload hanya diizinkan untuk admin atau teknisi pengelola laboratorium melalui
`can_manage_asset_data()`.

UI membuat signed URL berdurasi singkat saat pengguna membuka dokumen. Bucket
tidak boleh diubah menjadi public dan tidak memerlukan environment variable atau
service-role key pada Client Component.
