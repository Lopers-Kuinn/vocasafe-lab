# Mobile Performance Phase

Fase ini mengurangi pekerjaan latar belakang yang berjalan pada seluruh halaman tanpa mengubah alur bisnis, data Supabase, risk scoring, atau tampilan utama.

## Optimasi yang diterapkan

### Animasi latar

- Canvas tidak lagi menjalankan callback `requestAnimationFrame` terus-menerus ketika adegan sedang diam.
- Frame aktif dibatasi menjadi 30 FPS pada perangkat dengan pointer presisi dan 20 FPS pada perangkat sentuh.
- Saat tidak ada gelombang atau interaksi pointer, pemeriksaan berikutnya dijadwalkan setiap 250 ms tanpa menggambar ulang canvas.
- Animasi tetap berhenti sepenuhnya ketika tab disembunyikan dan menghormati `prefers-reduced-motion`.
- Gerakan pointer dapat membangunkan frame lebih cepat sehingga respons visual tetap terasa langsung.

### Sinkronisasi antrean lapangan

- Pemeriksaan awal IndexedDB dijalankan saat browser idle, dengan fallback timer untuk browser yang tidak mendukung `requestIdleCallback`.
- Polling antrean diubah dari 30 detik menjadi 60 detik.
- Polling tidak bekerja ketika tab tersembunyi atau perangkat offline.
- Event `online` tetap memicu retry segera, sedangkan submit form tetap memulai sinkronisasi tanpa menunggu interval.
- Proteksi single-flight di `processFieldOutbox` tetap mencegah proses sinkronisasi ganda.

### Notifikasi operasional

- Request notifikasi tidak dijalankan ketika tab tersembunyi atau perangkat offline.
- Request baru tidak dimulai selama request sebelumnya masih berjalan.
- Membuka pusat notifikasi selalu meminta data terbaru.
- Polling aktif tetap berjalan setiap 60 detik ketika aplikasi terlihat.

### QR scanner

Library `html5-qrcode` sudah dimuat melalui dynamic import hanya setelah pengguna meminta kamera. Library tidak dimuat ketika pengguna hanya memakai input kode manual.

## Runtime profiling yang disarankan

1. Gunakan Chrome DevTools Performance pada `/dashboard` selama minimal 20 detik dan pastikan tidak ada long task berulang dari canvas.
2. Sembunyikan tab selama dua menit dan pastikan tidak ada polling notifikasi atau outbox baru pada Network panel.
3. Kembali ke tab dan pastikan notifikasi serta antrean tersinkron kembali satu kali.
4. Buka `/scan` tanpa menyalakan kamera dan pastikan chunk `html5-qrcode` belum diminta.
5. Nyalakan kamera dan pastikan scanner tetap responsif serta dapat dihentikan.
6. Uji form laporan dan checklist saat online, offline, lalu online kembali.

## Batasan

Hasil build lokal memastikan integritas kode, tetapi pengukuran frame rate, konsumsi CPU, penggunaan memori, dan Web Vitals perlu dilakukan pada perangkat target nyata. Fase ini tidak menambah dependency atau migration database.
