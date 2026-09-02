# Real-User Testing — Mobile Field Experience

Dokumen ini adalah protokol Phase 6 untuk menguji VocaSafe Lab bersama pengguna nyata. Dokumen ini **bukan hasil pengujian**. Status lulus hanya boleh diberikan setelah sesi dilakukan, bukti dicatat, dan temuan ditriase pada `docs/real-user-test-results.md`.

## 1. Tujuan

Pengujian harus membuktikan bahwa pengguna lapangan dapat:

- mengambil keputusan aman setelah scan aset;
- mengirim laporan atau checklist tanpa kehilangan data saat koneksi terganggu;
- memahami prioritas risiko tanpa menganggap AI sebagai keputusan final;
- menerima, mengakui, dan menindaklanjuti pekerjaan sesuai role;
- menyelesaikan tugas pada ponsel tanpa kontrol terpotong, salah tekan, atau kebingungan navigasi;
- hanya melihat dan mengubah data yang diizinkan untuk akun dan laboratoriumnya.

## 2. Peserta minimum

Gunakan akun dan data sintetis pada environment preview/staging.

| Role | Minimum | Fokus |
|---|---:|---|
| Mahasiswa | 2 | Scan, keputusan keselamatan, laporan bahaya, bukti foto |
| Dosen | 1 | Checklist inspeksi dan temuan risiko |
| Teknisi/Laboran | 1 | Notifikasi, pengakuan tugas, tindak lanjut, status aset |
| Kepala Laboratorium | 1 | Monitoring, laporan, audit, batas kewenangan |
| Admin | 1 | Data dasar, aset, user, audit, akses global |

Target minimum adalah 6 peserta. Bila waktu memungkinkan, gunakan 8–10 peserta agar variasi perangkat dan tingkat pengalaman lebih terwakili. Peserta tidak boleh diarahkan langkah demi langkah kecuali telah meminta bantuan; setiap bantuan harus dicatat.

## 3. Perangkat dan kondisi uji

Minimal cakupan perangkat:

- Android kelas rendah/menengah dengan Chrome;
- Android terkini dengan Chrome;
- iPhone dengan Safari;
- desktop/laptop dengan keyboard;
- viewport 320 px dan 390 px;
- zoom desktop 200%;
- satu sesi Chrome + NVDA atau Safari + VoiceOver;
- koneksi normal, koneksi lambat, offline, lalu online kembali;
- HTTPS untuk kamera QR dan pengambilan foto langsung.

Jangan memakai data insiden nyata, data kesehatan, nomor pribadi, atau foto sensitif. Gunakan foto uji, nomor kontak uji, dan identitas peserta berupa kode seperti `MHS-01`.

## 4. Aturan fasilitasi

1. Jelaskan bahwa yang diuji adalah sistem, bukan kemampuan peserta.
2. Minta persetujuan sebelum merekam layar atau suara.
3. Gunakan metode *think aloud* tanpa memberi petunjuk jawaban.
4. Catat waktu mulai/selesai, salah tekan, kebingungan, bantuan, error, dan komentar spontan.
5. Hentikan skenario bila UI dapat mendorong penggunaan aset tidak aman, data lintas lab terlihat, bukti hilang, atau submit berulang menghasilkan duplikasi.
6. Jangan merekam password, token, API key, signed URL lengkap, atau isi `.env.local`.

## 5. Skenario per role

### RT-MHS-01 — Scan dan keputusan keselamatan

1. Login sebagai mahasiswa.
2. Buka Scan QR tanpa diberi tahu posisi menu.
3. Scan aset berstatus layak, lalu aset yang dibatasi/LOTO.
4. Minta peserta menjelaskan apakah aset boleh digunakan dan tindakan berikutnya.
5. Gunakan tombol kontak laboratorium pada aset yang dibatasi; batalkan sebelum panggilan tersambung.

Lulus bila status operasional tidak tertukar, alasan pembatasan dipahami, kontak dapat ditemukan, dan peserta tidak menganggap QR sebagai pengganti rambu/LOTO fisik.

### RT-MHS-02 — Laporan dengan kamera, galeri, dan gangguan koneksi

1. Dari aset, buat laporan bahaya.
2. Ambil foto langsung dari kamera, hapus, lalu pilih foto lain dari galeri.
3. Isi severity 5, probability 4, exposure 5; pastikan skor 100 dan kategori kritis.
4. Minta rekomendasi AI dan pastikan peserta memahami bahwa saran perlu ditinjau.
5. Matikan koneksi sebelum submit, kirim laporan, reload satu kali, lalu aktifkan koneksi.
6. Pastikan antrean tersinkron menjadi tepat satu laporan dan satu bukti.

Lulus bila draft tidak hilang, status offline jelas, bukti tetap ada, tidak terjadi duplikasi, dan nilai akhir tetap ditentukan pengguna.

### RT-DSN-01 — Checklist inspeksi

1. Login sebagai dosen dan buka checklist baru untuk aset uji.
2. Jawab item secara tidak berurutan.
3. Gunakan navigator **Belum dijawab** dan **Temuan**.
4. Tandai satu temuan, isi 5 × 4 × 5, tambah catatan dan bukti.
5. Submit saat koneksi lambat atau sempat offline.
6. Ulangi checklist tanpa risiko dengan semua item aman/N/A.

Lulus bila semua item dapat ditemukan, item tidak terlewat, checklist risiko tersimpan sebagai 100/kritis, checklist tanpa risiko menyimpan risk fields `null`, dan retry tidak menduplikasi hasil.

### RT-TKN-01 — Respons operasional

1. Login sebagai teknisi.
2. Buka pusat notifikasi dan temukan laporan baru.
3. Akui/ambil tugas, tentukan tenggat, lalu buka detail laporan.
4. Tambahkan tindak lanjut dan ubah status sesuai proses kerja.
5. Reload dan pastikan status, assignment, serta riwayat tetap tersimpan.
6. Scan aset terkait dan pastikan keputusan keselamatan konsisten dengan status aset.

Lulus bila teknisi memahami pekerjaan prioritas, tidak ada aksi ganda saat tombol ditekan berulang, riwayat persisten, dan status laporan/aset tidak menyesatkan.

### RT-KPL-01 — Monitoring dan audit

1. Login sebagai kepala laboratorium.
2. Temukan risiko kritis dan laporan belum selesai dari dashboard.
3. Buka daftar laporan, checklist, dan audit untuk laboratorium yang diizinkan.
4. Coba membuka route yang tidak diizinkan seperti scan, laporan baru, checklist baru, dan admin.
5. Export CSV dan buka print preview audit.

Lulus bila informasi utama dapat ditemukan tanpa menghitung manual, data lintas lab tidak terlihat, route terlarang ditolak, CSV tidak kosong, dan print preview tidak terpotong.

### RT-ADM-01 — Administrasi dan akses global

1. Login sebagai admin.
2. Tambah/edit aset uji melalui modal dan gunakan keyboard untuk menutup serta mengembalikan fokus.
3. Periksa data laboratorium, template, item checklist, dan user.
4. Ubah role/status user uji, refresh, verifikasi persistensi, lalu kembalikan nilai awal.
5. Pastikan proteksi akun admin sendiri tetap berlaku.

Lulus bila perubahan hanya terjadi setelah konfirmasi yang jelas, modal tidak memerlukan scroll halaman untuk ditemukan, fokus tidak lolos dari dialog, dan nilai awal user uji berhasil dipulihkan.

## 6. Uji lintas role dan akses

- Reporter hanya melihat laporan yang diizinkan.
- Pengelola laboratorium tidak melihat data laboratorium lain.
- Mahasiswa tidak dapat membuka checklist atau audit.
- Dosen tidak dapat membuka audit.
- Kepala laboratorium tidak dapat membuat laporan/checklist baru atau membuka admin.
- Teknisi hanya mengelola aset dan respons pada cakupan laboratoriumnya.
- Admin memiliki akses global tetapi tidak dapat menonaktifkan atau menurunkan role akun sendiri.
- Signed URL bukti tidak ditampilkan kepada user yang tidak berhak.

Setiap kegagalan isolasi data adalah **Blocker** dan pengujian harus dihentikan.

## 7. Metrik dan target

| Metrik | Target release |
|---|---:|
| Penyelesaian seluruh tugas | >= 90% tanpa bantuan |
| Tugas keputusan keselamatan kritis | 100% benar |
| Salah tafsir aset dibatasi sebagai aman | 0 |
| Kehilangan draft/bukti | 0 |
| Duplikasi akibat retry/double tap | 0 |
| Crash atau error 500 pada alur utama | 0 |
| Median scan hingga keputusan keselamatan | <= 30 detik |
| Median membuat laporan lengkap | <= 3 menit |
| Median checklist 10 item | <= 6 menit |
| SEQ per tugas (skala 1–7) | median >= 5 |
| SUS setelah sesi (skala 0–100) | >= 75 |

Target ini adalah release gate internal prototype, bukan klaim benchmark industri atau hasil yang sudah tercapai.

## 8. Pertanyaan setelah tugas

Setelah setiap tugas, tanyakan SEQ: “Seberapa mudah atau sulit tugas ini?” dari 1 (sangat sulit) sampai 7 (sangat mudah). Setelah seluruh sesi, gunakan SUS standar dan pertanyaan terbuka:

- Bagian mana yang paling membuat ragu?
- Informasi apa yang dibutuhkan sebelum memutuskan aset aman digunakan?
- Apakah status sinkronisasi dan submit sudah dapat dipercaya?
- Apakah istilah risiko, status laporan, dan LOTO mudah dipahami?
- Tindakan apa yang paling sulit ditemukan?
- Apa satu perubahan yang paling membantu saat digunakan di lapangan?

## 9. Klasifikasi temuan

| Tingkat | Definisi | Keputusan |
|---|---|---|
| Blocker | Kebocoran data, keputusan keselamatan salah, kehilangan data, atau alur utama tidak dapat selesai | Hentikan release |
| Critical | Risiko serius pada alur kritis tanpa workaround yang aman | Hentikan release |
| Major | Tugas dapat selesai hanya dengan bantuan/workaround atau terjadi kebingungan berulang | Perbaiki sebelum pilot |
| Minor | Gangguan visual/teks dengan alur tetap jelas dan aman | Boleh dijadwalkan dengan catatan |

## 10. Release gate Phase 6

Phase 6 hanya lulus bila:

- semua role minimum telah diuji pada perangkat nyata;
- tidak ada Blocker atau Critical terbuka;
- keputusan keselamatan kritis benar 100%;
- tidak ada kehilangan atau duplikasi data pada retry;
- isolasi role dan laboratorium lulus;
- kamera, galeri, offline queue, reconnect, notifikasi, CSV, dan print diuji;
- keyboard, screen reader, 320 px, 390 px, zoom 200%, dan reduced motion diuji;
- seluruh Major mempunyai perbaikan terverifikasi atau keputusan tertulis untuk menunda pilot;
- `git diff --check`, typecheck, lint, dan production build lulus;
- hasil serta bukti telah dicatat pada lembar hasil.

## 11. Pembersihan setelah tes

- Pulihkan role dan status akun uji.
- Hapus artefak/foto uji melalui prosedur admin yang disetujui; jangan melemahkan RLS.
- Pastikan tidak ada password, secret, atau data pribadi dalam screenshot.
- Catat ID data uji sebelum pembersihan agar perubahan dapat diaudit.

