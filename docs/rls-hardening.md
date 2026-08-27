# D4-13 RLS Hardening

Dokumen ini menjelaskan perubahan policy pada
`supabase/migrations/002_d4_rls_hardening.sql`. Migration harus direview dan
dijalankan manual. Aplikasi tidak memakai service role key untuk melewati RLS.

## Ringkasan audit policy awal

Migration awal sudah mengaktifkan RLS pada seluruh tabel aplikasi, tetapi masih
memiliki beberapa policy MVP yang terlalu luas atau belum lengkap:

- seluruh pengguna terautentikasi dapat membaca seluruh laporan, follow-up, dan
  metadata attachment;
- teknisi dan admin merupakan satu-satunya role yang dapat mengelola status
  laporan dan follow-up;
- admin belum dapat mengubah `user_profiles.role` atau
  `user_profiles.is_active`;
- policy master data memakai `FOR ALL`, sehingga secara tidak sengaja juga
  mencakup operasi delete;
- dosen dapat membuat checklist tetapi tidak dapat membaca hasil checklistnya
  sendiri;
- policy Storage D4-8 hanya memeriksa bucket dan belum memeriksa kepemilikan
  laporan, pola path, atau ekstensi file;
- helper `SECURITY DEFINER` belum membatasi hak execute secara eksplisit.

## Helper authorization

Migration mempertahankan helper kompatibel yang sudah ada dan menambah:

- `public.is_current_user_active()` untuk menolak akses data aplikasi dari
  profil nonaktif;
- `public.is_report_manager()` untuk role `teknisi`, `kepala_lab`, dan `admin`.

Semua helper memakai `SECURITY DEFINER`, `search_path = public`, tidak memakai
dynamic SQL, dan hak execute dicabut dari `PUBLIC`/`anon` lalu diberikan kepada
`authenticated`.

## Matrix akses setelah D4-13

| Data/operasi | Mahasiswa | Dosen | Teknisi | Kepala Lab | Admin |
|---|---|---|---|---|---|
| Profil sendiri | Baca | Baca | Baca | Baca | Baca |
| Semua profil | - | - | - | - | Baca |
| Role/status user lain | - | - | - | - | Update |
| Master data | Baca | Baca | Baca | Baca | Baca |
| Master data insert/update | - | - | - | - | Diizinkan RLS, UI tetap read-only |
| Laporan sendiri | Baca/buat | Baca/buat | Baca/buat | Baca semua | Baca/buat |
| Semua laporan | - | - | Baca | Baca | Baca |
| Status/follow-up laporan | - | - | Kelola | Kelola | Kelola |
| Template/item checklist | - | Baca | Baca | Baca untuk konteks audit | Baca |
| Hasil checklist sendiri | - | Baca/buat | Baca/buat | Baca semua | Baca/buat |
| Semua hasil checklist | - | - | Baca | Baca | Baca |
| Audit logs | - | - | - | - | Baca |

Route guard aplikasi tetap menjadi lapisan UI. RLS adalah lapisan otorisasi
database dan dapat menghasilkan subset data yang berbeda per role. Mahasiswa
dan dosen tetap dapat membuka `/reports`, tetapi hanya melihat laporan sendiri.

## Policy profil pengguna

- Pengguna terautentikasi dapat membaca profil sendiri, termasuk saat profil
  nonaktif agar aplikasi dapat menampilkan pesan akun nonaktif.
- Admin aktif dapat membaca semua profil.
- Admin aktif dapat memperbarui profil user lain.
- Admin tidak dapat mengubah row profilnya sendiri.
- Hak kolom membatasi browser ke `role`, `is_active`, dan `updated_at`.
- Pembuatan dan penghapusan Auth user tetap dilakukan manual melalui Supabase
  Dashboard.

## Policy laporan dan bukti

- Reporter aktif hanya dapat membaca laporan sendiri.
- Report manager dapat membaca seluruh laporan dan mengubah `status` serta
  `updated_at`.
- Insert laporan wajib memakai `reporter_id = auth.uid()`, status `baru`, dan
  skor/kategori yang konsisten dengan severity × probability × exposure.
- Follow-up hanya dapat dibuat report manager dengan `created_by = auth.uid()`.
- Metadata dan object bukti hanya dapat dibaca oleh reporter atau report
  manager.
- Upload Storage wajib memakai bucket private `report-evidence`, path
  `reports/{reportId}/{fileName}`, dan ekstensi JPG/JPEG/PNG/WebP.
- Migration juga menghapus policy manual lama
  `report_evidence_authenticated_upload` dan
  `report_evidence_authenticated_read` agar akses luas tidak tetap aktif.
- Policy update/delete attachment dan object tidak dibuka.

## Policy checklist

- Dosen, teknisi, dan admin dapat membaca template/item untuk mengisi
  checklist. Kepala laboratorium dapat membacanya sebagai konteks audit.
- Dosen melihat hasil miliknya sendiri.
- Teknisi, kepala laboratorium, dan admin melihat seluruh hasil.
- Insert hasil wajib memakai `inspector_id = auth.uid()` dan template aktif.
- Insert hasil tanpa temuan wajib menyimpan seluruh faktor, skor, kategori, dan
  rekomendasi sebagai `null`; hasil dengan temuan wajib memiliki faktor 1–5
  serta skor dan kategori yang konsisten.
- Insert jawaban harus merujuk item dari template yang sama dengan hasilnya.
- Jawaban hanya dapat dimasukkan oleh inspector pemilik hasil dengan role
  dosen, teknisi, atau admin. Kepala laboratorium tetap read-only.
- Policy update/delete hasil checklist tidak dibuka.

## Menjalankan migration secara manual

1. Pastikan migration `001_initial_d4_schema.sql` dan setup bucket
   `report-evidence` sudah diterapkan.
2. Review seluruh isi `002_d4_rls_hardening.sql`.
3. Buat backup atau gunakan environment staging terlebih dahulu.
4. Buka Supabase SQL Editor sebagai project owner.
5. Salin seluruh migration dan jalankan satu kali. Migration memakai transaksi.
6. Jangan menjalankan sebagian policy secara terpisah kecuali sedang melakukan
   rollback terencana.
7. Refresh aplikasi dan jalankan checklist runtime berikut.

Codex tidak menjalankan migration ini secara otomatis.

## Checklist runtime test

### Admin

- `/admin` menampilkan seluruh profile.
- Ubah role user test, pastikan UI dan SQL berubah, lalu kembalikan.
- Nonaktifkan user test, pastikan akses database ditolak, lalu aktifkan kembali.
- Pastikan role/status akun admin sendiri tidak dapat diubah.

### Reports

- Mahasiswa dan dosen hanya melihat laporan sendiri.
- Mahasiswa/dosen dapat membuat laporan dengan bukti foto.
- Mahasiswa/dosen tidak dapat mengubah status atau menambah follow-up.
- Teknisi, kepala laboratorium, dan admin melihat semua laporan.
- Teknisi pada laboratoriumnya dan admin dapat mengubah status serta menambah follow-up. Kepala laboratorium tetap dapat membaca laporan sesuai scope, tetapi view-only untuk mutation.
- Signed URL bukti hanya berhasil untuk reporter atau report manager.
- Upload selain JPG/JPEG/PNG/WebP atau path di luar kontrak ditolak.

### Checklist

- Dosen dapat membuat checklist dan membaca hasilnya sendiri.
- Dosen tidak dapat membaca hasil dosen/user lain.
- Teknisi, kepala laboratorium, dan admin dapat membaca semua hasil.
- Mahasiswa tidak dapat membaca template atau hasil checklist.

### Master data

- User aktif dapat membaca lab, SOP, aset, fasilitas K3, dan risk points.
- User nonaktif tidak dapat membacanya.
- Tidak ada operasi delete master data dari client.

## Risiko tersisa

- Proteksi self-update mencegah admin menonaktifkan atau menurunkan role akun
  sendiri, tetapi dua admin yang melakukan perubahan silang secara bersamaan
  masih dapat menimbulkan risiko tidak ada admin aktif. Proteksi last-admin
  atomik membutuhkan fungsi/trigger khusus dan belum ditambahkan.
- Perubahan role/status belum otomatis dicatat ke `audit_logs`.
- Perubahan role user yang sedang login baru sepenuhnya terlihat setelah profile
  atau session aplikasi dimuat ulang.
- Jika penyimpanan metadata attachment gagal setelah object berhasil diunggah,
  cleanup client dapat ditolak karena policy delete Storage tetap tertutup;
  object orphan perlu dibersihkan secara administratif.
- Signed URL yang sudah diterbitkan tetap berlaku hingga masa berlakunya habis.
- Query agregat dashboard/audit masih mengambil row yang terlihat oleh RLS dan
  belum dioptimalkan menjadi query agregat database.
- Migration ini mengandalkan bucket `report-evidence` yang sudah private dan
  tidak mengubah konfigurasi bucket.
