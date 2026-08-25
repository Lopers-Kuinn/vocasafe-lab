# Asset Management and Operational Filters

## Scope

Fitur ini menambahkan pencarian dan filter riwayat checklist, filter risiko dan laboratorium pada laporan, tambah/edit aset, pengelolaan SOP per aset, PIC, kontak darurat, QR siap cetak, serta riwayat aktivitas aset.

## Role

- `admin`: mengelola aset pada seluruh laboratorium.
- `teknisi`: mengelola aset hanya pada laboratorium yang terhubung dengan profilnya.
- `mahasiswa`, `dosen`, dan `kepala_lab`: melihat data aset sesuai RLS tanpa kontrol tambah/edit.

Kontrol UI bukan batas keamanan utama. Mutation aset dijalankan melalui RPC yang kembali memeriksa session, profil aktif, role, dan laboratorium di database.

## Migration 008

File `supabase/migrations/008_asset_management_and_activity.sql` harus direview dan dijalankan manual setelah migration 007. Migration tidak dijalankan otomatis oleh implementasi UI.

Migration menambahkan:

- `assets.pic_user_id`;
- `laboratories.emergency_contact_name`;
- `laboratories.emergency_contact_phone`;
- tabel `asset_activity_logs` dengan RLS;
- helper authorization `can_manage_asset_data()`;
- RPC daftar kandidat PIC dan informasi kontak aset;
- RPC atomik `save_asset_record()`;
- RPC `add_asset_activity_log()`.

Mutation tidak menggunakan service role dan tidak memberikan direct INSERT/UPDATE pada `asset_activity_logs` kepada browser. Seluruh write log manual dilakukan melalui RPC yang memvalidasi role dan laboratory scope.

## SOP Copy-on-Write

Jika SOP global atau SOP yang digunakan lebih dari satu aset diedit dari halaman detail aset, RPC membuat salinan SOP khusus pada laboratorium aset dan menghubungkannya ke aset tersebut. SOP aset lain tidak berubah secara diam-diam. SOP lab-spesifik yang hanya digunakan oleh satu aset dapat diperbarui langsung.

## Riwayat Aktivitas

Halaman detail menggabungkan data yang diizinkan RLS dari:

- laporan bahaya terkait aset;
- hasil checklist terkait aset;
- log manual servis, perbaikan, dan catatan;
- log otomatis saat aset atau SOP diperbarui melalui RPC.

Riwayat yang terlihat selalu mengikuti hak akses session aktif. UI tidak menggunakan service role untuk memperluas hasil.

## Checklist Runtime

Setelah migration diterapkan:

1. Login admin dan pastikan tombol `Tambah Aset` tersedia.
2. Buat aset dengan kode unik lalu pastikan detail dan QR dapat dibuka.
3. Login teknisi dan pastikan hanya laboratoriumnya yang dapat dipilih/dikelola.
4. Pastikan dosen, mahasiswa, dan kepala laboratorium tidak melihat tombol tambah/edit.
5. Edit lokasi, deskripsi, jadwal inspeksi, PIC, kontak darurat, dan SOP.
6. Pastikan edit SOP bersama tidak mengubah SOP aset lain.
7. Download QR sebagai PNG dan buka print preview stiker.
8. Tambahkan log servis/perbaikan dan pastikan tersimpan setelah reload.
9. Uji pencarian serta filter checklist untuk hari ini, 7 hari, 30 hari, dan 12 bulan.
10. Uji filter laporan berdasarkan risiko dan laboratorium.
11. Uji teknisi dari laboratorium lain melalui REST/RPC dan pastikan mutation ditolak.

## Rollback

Jangan mengedit migration 008 setelah diterapkan. Buat migration koreksi baru untuk mengganti function/policy. Hindari menghapus kolom PIC atau tabel aktivitas sebelum memastikan tidak ada data operasional yang masih dibutuhkan.
