# Operational Response

Phase ini menutup jarak antara laporan bahaya dan tindakan petugas melalui acknowledgement, penetapan PIC, tenggat respons, serta notifikasi dalam aplikasi.

## Alur

1. Laporan baru memberi notifikasi kepada teknisi dan kepala laboratorium pada laboratorium terkait serta admin.
2. Teknisi atau admin membuka detail laporan, mengakui laporan, memilih PIC, menetapkan tenggat, dan menulis catatan awal.
3. Laporan berstatus `baru` berpindah ke `diverifikasi`; status lain tidak dimundurkan.
4. PIC menerima notifikasi penugasan. Reporter dan PIC menerima notifikasi ketika tindak lanjut berikutnya dicatat.
5. Daftar laporan dapat difilter berdasarkan tugas pengguna, laporan tanpa PIC, atau tenggat yang terlewati.
6. Tindakan korektif checklist yang memiliki PIC juga menghasilkan notifikasi.

## Migration wajib

Review lalu jalankan `supabase/migrations/015_operational_response_notifications.sql` secara manual melalui Supabase SQL Editor setelah migration 014.

Migration ini:

- menambahkan kolom acknowledgement, PIC, dan tenggat pada `reports`;
- membuat tabel `user_notifications` dengan RLS baca hanya untuk penerima;
- membuat trigger notifikasi laporan dan tindakan korektif;
- membuat RPC atomik untuk acknowledgement/assignment dan penandaan notifikasi dibaca;
- tidak memakai service role dan tidak mengubah rumus risk scoring.

Sebelum migration diterapkan, daftar dan detail laporan tetap menggunakan schema lama. Pusat notifikasi dan kontrol Operational Response menampilkan pesan kesiapan tanpa merusak alur laporan lama.

## Keamanan dan role

- Notifikasi hanya dapat dibaca oleh pemiliknya.
- Client tidak dapat langsung menambah, mengubah, atau menghapus row notifikasi.
- Penetapan respons mensyaratkan role teknisi/admin sekaligus mengikuti `can_manage_report()`; pilihan PIC dibatasi pada teknisi satu laboratorium atau admin aktif.
- UI penetapan respons mengikuti akses edit laporan saat ini: teknisi dan admin.
- Kepala laboratorium menerima notifikasi operasional dan tetap dapat memantau laporan sesuai cakupan RLS, tetapi tidak mendapat kontrol edit di UI.
- Tenggat bersifat indikator operasional; status selesai atau ditolak tidak ditandai terlambat.

## Batasan

Notifikasi adalah in-app notification dengan polling ringan saat aplikasi terbuka. Phase ini tidak menambahkan push notification, email, cron, atau layanan pihak ketiga. Pengingat tenggat ditampilkan dari data terkini ketika pengguna membuka atau memfokuskan aplikasi.

## Runtime test

1. Terapkan migration 015 pada environment uji.
2. Buat laporan baru sebagai mahasiswa dan pastikan teknisi laboratorium menerima notifikasi.
3. Buka detail sebagai teknisi, pilih PIC, tentukan tenggat, dan simpan acknowledgement.
4. Pastikan status `baru` menjadi `diverifikasi`, PIC/tenggat tampil setelah reload, dan hanya satu tindak lanjut baru tercatat.
5. Login sebagai PIC dan pastikan notifikasi penugasan membuka detail laporan yang benar.
6. Tambahkan tindak lanjut berikutnya dan pastikan reporter menerima notifikasi status.
7. Uji filter Tugas saya, Belum ada PIC, dan Tenggat terlewati.
8. Pastikan role tanpa izin hanya melihat ringkasan respons dan tidak melihat kontrol penetapan.
