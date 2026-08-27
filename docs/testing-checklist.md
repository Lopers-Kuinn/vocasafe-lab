# Final Testing Checklist VocaSafe Lab D4

Gunakan checklist ini sebelum merge, deploy, presentasi, atau pengambilan screenshot proposal. Checklist ini mengikuti kondisi D4 production-like: Supabase Auth, Supabase Database, Supabase Storage, RLS hardening, QR camera scanner, dan AI recommendation fallback sudah aktif.

## 1. Validasi Awal

- [ ] Branch aktif `feature/d4-production-like-migration`.
- [ ] Working tree clean.
- [ ] PR terbuka dan belum merge.
- [ ] `.env.local` tidak tracked oleh Git.
- [ ] `npm run typecheck` lulus.
- [ ] `npm run build` lulus.
- [ ] `npm run lint` dijalankan; jika gagal, catat error aktual (riwayat issue ada di `src/components/AppShell.tsx` rule `react-hooks/set-state-in-effect`).

## 2. Auth dan Route Guard

- [ ] `/` dapat dibuka tanpa login.
- [ ] `/login` dapat dibuka.
- [ ] `/dashboard` tanpa login diarahkan atau diblokir ke `/login`.
- [ ] Login admin Supabase berhasil.
- [ ] Logout berhasil dan session dibersihkan.
- [ ] User tanpa row `user_profiles` ditolak dengan pesan jelas.
- [ ] User inactive ditolak dengan pesan jelas.
- [ ] Role dibaca dari `user_profiles`, bukan dummy role/localStorage.

## 3. Role Access

### Mahasiswa

- [ ] Bisa akses `/dashboard`.
- [ ] Bisa akses `/scan`.
- [ ] Bisa akses `/assets`.
- [ ] Bisa akses `/reports`.
- [ ] Bisa akses `/reports/new`.
- [ ] Tidak bisa akses `/admin`.
- [ ] Tidak bisa akses `/checklists`.
- [ ] Tidak bisa akses `/checklists/new`.
- [ ] Tidak bisa akses `/audit`.
- [ ] Tidak melihat kontrol update status/follow-up laporan.

### Dosen

- [ ] Bisa akses `/dashboard`.
- [ ] Bisa akses `/scan`.
- [ ] Bisa akses `/assets`.
- [ ] Bisa akses `/reports`.
- [ ] Bisa akses `/reports/new`.
- [ ] Bisa akses `/checklists`.
- [ ] Bisa akses `/checklists/new`.
- [ ] Tidak bisa akses `/admin`.
- [ ] Tidak bisa akses `/audit`.
- [ ] Tidak melihat kontrol update status/follow-up laporan.

### Teknisi/Laboran

- [ ] Bisa akses `/dashboard`.
- [ ] Bisa akses `/scan`.
- [ ] Bisa akses `/assets`.
- [ ] Bisa akses `/reports`.
- [ ] Bisa akses `/reports/new`.
- [ ] Bisa akses `/checklists`.
- [ ] Bisa akses `/checklists/new`.
- [ ] Bisa akses `/audit`.
- [ ] Tidak bisa akses `/admin`.
- [ ] Bisa mengubah status laporan.
- [ ] Bisa menyimpan catatan tindak lanjut.

### Kepala Laboratorium

- [ ] Bisa akses `/dashboard`.
- [ ] Bisa akses `/assets`.
- [ ] Bisa akses `/reports`.
- [ ] Bisa akses `/audit`.
- [ ] Tidak bisa akses `/scan`.
- [ ] Tidak bisa akses `/reports/new`.
- [ ] Bisa akses `/checklists` untuk membaca hasil inspeksi.
- [ ] Tidak bisa akses `/checklists/new`.
- [ ] Tidak bisa akses `/admin`.
- [ ] Bisa melihat laporan lintas user sesuai RLS.
- [ ] Tidak melihat kontrol update status/follow-up laporan (view-only).

### Admin

- [ ] Bisa akses semua route.
- [ ] Bisa mengubah status laporan.
- [ ] Bisa menyimpan catatan tindak lanjut.
- [ ] Bisa membuka `/admin`.
- [ ] Bisa update role/status user lain lalu restore.
- [ ] Tidak bisa mengubah role/status akun sendiri.

## 4. Dashboard Supabase

- [ ] `/dashboard` tampil setelah login.
- [ ] Total asset sesuai tabel Supabase.
- [ ] Total laporan sesuai tabel Supabase yang terlihat oleh RLS.
- [ ] Total checklist sesuai tabel Supabase yang terlihat oleh RLS.
- [ ] Latest reports tampil dari Supabase.
- [ ] Latest checklist results tampil dari Supabase.
- [ ] Tidak ada console error fatal.

## 5. Assets, SOP, dan QR

- [ ] `/assets` menampilkan AST-001, AST-002, AST-003 dari Supabase.
- [ ] Nama laboratorium tampil.
- [ ] Status aset tampil benar.
- [ ] Search/filter asset berjalan jika tersedia.
- [ ] `/assets/AST-001` menampilkan detail asset.
- [ ] SOP Penggunaan Mesin Bor tampil untuk AST-001.
- [ ] APD dan langkah SOP tampil.
- [ ] QR Code tampil.
- [ ] QR payload mengarah ke `vocasafe://assets/AST-001` atau detail asset yang sesuai.
- [ ] Link laporan bahaya mengarah ke `/reports/new?assetId=AST-001`.
- [ ] Unknown asset ditangani rapi.
- [ ] Tidak ada console error fatal.

## 6. Scan QR

- [ ] `/scan` tampil untuk role yang berhak.
- [ ] Input manual `AST-001` redirect ke `/assets/AST-001`.
- [ ] Input manual `vocasafe://assets/AST-001` redirect ke `/assets/AST-001`.
- [ ] Input `UNKNOWN` menampilkan error rapi.
- [ ] Camera QR scan berhasil jika perangkat/kamera tersedia.
- [ ] Input manual tetap tersedia sebagai fallback.
- [ ] Tidak ada console error fatal.

## 7. Reports dan Evidence Storage

- [ ] `/reports` menampilkan laporan dari Supabase.
- [ ] `/reports/new?assetId=AST-001` otomatis memilih asset AST-001 dari Supabase.
- [ ] Form laporan memakai asset UUID untuk insert, code hanya untuk display.
- [ ] Input severity 5, probability 4, exposure 5 menghasilkan score 100.
- [ ] Score 100 berkategori kritis.
- [ ] Rekomendasi rule-based kategori kritis benar.
- [ ] Tombol `Buat Rekomendasi AI` menampilkan fallback tanpa API key.
- [ ] Submit laporan tanpa foto berhasil.
- [ ] Detail laporan tampil.
- [ ] Submit laporan dengan foto JPG/PNG/WebP berhasil.
- [ ] Evidence masuk bucket private `report-evidence`.
- [ ] Metadata evidence masuk `report_attachments`.
- [ ] Evidence tampil melalui signed URL di detail laporan.
- [ ] Tidak ada console error fatal.

## 8. Report Follow-Up dan Role Manager

- [ ] Role manager membuka detail laporan.
- [ ] Kontrol update status/follow-up tampil untuk role yang berhak.
- [ ] Status dapat diubah ke `diverifikasi`.
- [ ] Status dapat diubah ke `dalam_penanganan`.
- [ ] Status dapat diubah ke `selesai` jika diperlukan.
- [ ] Catatan follow-up tersimpan ke Supabase.
- [ ] Riwayat follow-up tampil setelah reload.
- [ ] Status dropdown mengikuti status laporan terakhir setelah reload.
- [ ] Reporter/mahasiswa dapat melihat laporan sendiri.
- [ ] Reporter/mahasiswa tidak melihat kontrol update status/follow-up.
- [ ] Tidak ada console error fatal.

## 9. Checklist K3

- [ ] `/checklists` menampilkan template aktif dan hasil checklist dari Supabase.
- [ ] `/checklists/new?assetId=AST-001` otomatis memilih AST-001.
- [ ] Template aktif dari Supabase terbaca.
- [ ] 10 item checklist tampil.
- [ ] Submit checklist dengan risiko berhasil:
  - [ ] Salah satu item critical bernilai `tidak`.
  - [ ] Severity 5.
  - [ ] Probability 4.
  - [ ] Exposure 5.
  - [ ] Score 100.
  - [ ] Category kritis.
  - [ ] 10 jawaban masuk `checklist_result_items`.
- [ ] Submit checklist tanpa risiko berhasil:
  - [ ] Semua item aman atau N/A sesuai skenario.
  - [ ] Risk fields tersimpan `null`.
  - [ ] Hasil tampil di `/checklists`.
- [ ] Tidak ada console error fatal.

## 10. Audit

- [ ] `/audit` tampil untuk role yang berhak.
- [ ] Summary asset/laporan/checklist berasal dari Supabase.
- [ ] Distribusi risiko tampil.
- [ ] Status laporan tampil.
- [ ] Hasil checklist tampil.
- [ ] Temuan kritis tampil.
- [ ] Export CSV berhasil.
- [ ] CSV berisi data laporan Supabase.
- [ ] CSV berisi data checklist Supabase.
- [ ] Print / Save as PDF memanggil browser print preview.
- [ ] Layout print bersih dan tombol aksi tersembunyi saat print jika CSS print aktif.
- [ ] Tidak ada console error fatal.

## 11. Admin

- [ ] `/admin` hanya bisa diakses admin.
- [ ] `user_profiles` tampil.
- [ ] UUID tidak ditampilkan di UI utama.
- [ ] `laboratories` tampil.
- [ ] `assets` tampil.
- [ ] `checklist_templates` tampil.
- [ ] `checklist_items` tampil.
- [ ] Admin bisa update role user lain lalu restore.
- [ ] Admin bisa update `is_active` user lain lalu restore.
- [ ] Admin tidak bisa mengubah role/status akun sendiri.
- [ ] Tidak ada console error fatal.

## 12. AI Recommendation Fallback

- [ ] `AI_PROVIDER=none` atau API key kosong tetap menghasilkan fallback.
- [ ] Provider failure tidak membuat UI crash.
- [ ] AI recommendation tidak mengganti risk score.
- [ ] API menolak input jika risk score tidak konsisten dengan severity x probability x exposure.
- [ ] Secret AI key tidak dipakai di Client Component.

## 13. Security/Regression Grep

- [ ] `.env.local` tidak tracked.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` tidak dipakai di Client Component.
- [ ] `createSupabaseAdminClient` tidak dipakai di browser/client pages.
- [ ] `OPENAI_API_KEY`, `GEMINI_API_KEY`, dan `DEEPSEEK_API_KEY` tidak dipakai di Client Component.
- [ ] `localStorage` tidak menjadi sumber utama route D4 aktif:
  - [ ] `src/app/reports`
  - [ ] `src/app/checklists`
  - [ ] `src/app/dashboard`
  - [ ] `src/app/audit`
- [ ] `dummyAssets`, `dummyReports`, dan `dummyChecklists` tidak menjadi sumber utama route D4 aktif.
- [ ] Tidak ada migration baru setelah D4-13 tanpa review.
- [ ] Tidak ada dependency berubah setelah D4-14/D4-15 tanpa izin.

## 14. Mobile 390px

- [ ] Tidak ada horizontal overflow.
- [ ] Menu mobile bisa dibuka dan ditutup.
- [ ] Form laporan nyaman digunakan.
- [ ] Form checklist nyaman digunakan.
- [ ] Scan page nyaman digunakan.
- [ ] Tombol utama tidak tertutup navigasi.
- [ ] Card digunakan di mobile saat tabel desktop tidak cocok.

## 15. Release Gate

- [ ] Full manual browser QA lulus.
- [ ] `npm run typecheck` lulus.
- [ ] `npm run build` lulus.
- [ ] Hasil lint aktual dicatat; jangan mengasumsikan known issue lama masih terjadi.
- [ ] PR body sesuai scope D4.
- [ ] Tidak ada secret di repo.
- [ ] Belum merge sebelum approval.
- [ ] Belum production deploy sebelum deploy approval.
