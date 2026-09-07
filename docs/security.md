# Keamanan

## Identitas dan role

Supabase Auth menjadi sumber session. Setiap pengguna harus memiliki `user_profiles` aktif dengan role resmi: mahasiswa, dosen, teknisi, kepala laboratorium, atau admin.

Route guard membantu navigasi, sedangkan Row Level Security menjadi pengaman utama pada database dan Storage.

## Isolasi laboratorium

- Mahasiswa dan dosen bekerja pada data yang diizinkan untuk akun mereka.
- Teknisi dan kepala laboratorium dibatasi pada laboratorium yang ditugaskan.
- Admin memiliki cakupan global untuk administrasi sistem.
- Reporter dapat membaca laporan miliknya sesuai policy.
- Inspector dapat membaca hasil checklist miliknya sesuai policy.
- Child resource mengikuti otorisasi parent report atau checklist.

## Integritas data

- Asset dan report harus berasal dari laboratorium yang konsisten.
- Checklist template, item, result, dan asset divalidasi sebelum insert.
- Risk score harus sama dengan `severity × probability × exposure`.
- Follow-up dan perubahan status memakai operasi atomik.
- Submission offline memakai identifier idempotensi untuk mencegah duplikasi.
- Admin tidak dapat menurunkan role atau menonaktifkan akunnya sendiri.

## Bukti private

Bucket `report-evidence` bersifat private. Metadata attachment dan path Storage divalidasi terhadap report serta pengguna yang berhak. Browser menerima signed URL dengan masa berlaku terbatas.

## Secret

- `.env.local` tidak boleh masuk Git.
- API key AI hanya dibaca server.
- Supabase service-role key tidak digunakan oleh browser.
- Password akun demo hanya berada dalam environment server.
- Log tidak boleh menampilkan password, token, cookie, atau raw provider response.

## Validasi keamanan minimum

- akses tanpa session ditolak;
- profil missing/inactive ditolak;
- akses lintas laboratorium ditolak oleh RLS;
- route dan kontrol sesuai role;
- upload serta signed URL ditolak untuk pengguna tanpa hak;
- request AI ke-11 dalam 60 detik mendapat HTTP 429;
- error internal tidak diteruskan apa adanya kepada pengguna.
