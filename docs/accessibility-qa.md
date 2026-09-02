# Accessibility QA — WCAG 2.2 AA Target

Audit Phase 5 berfokus pada alur mobile utama: navigasi aplikasi, scan QR, laporan bahaya, checklist, notifikasi, filter, dan pengelolaan aset. Implementasi ini menargetkan WCAG 2.2 Level AA, tetapi klaim kepatuhan penuh tetap memerlukan pengujian assistive technology pada perangkat nyata.

## Perbaikan yang diterapkan

- Skip link **Lewati ke konten utama** tersedia pada layout aplikasi.
- Fokus keyboard terlihat secara konsisten pada tautan, tombol, field form, summary, dan elemen bertabindex.
- Label pilihan yang menyembunyikan radio/checkbox tetap menampilkan indikator ketika input menerima fokus keyboard.
- Dialog notifikasi, filter mobile, menu mobile, dan form aset mengunci fokus Tab di dalam dialog.
- Escape menutup dialog dan fokus dikembalikan ke kontrol yang membukanya.
- Scroll halaman belakang dikunci saat dialog aktif.
- Tombol ikon utama dan aksi dialog memiliki target sentuh minimum 48 piksel.
- Animasi global menghormati `prefers-reduced-motion`.
- Pesan error utama menggunakan `role="alert"`; proses sinkronisasi, loading, dan optimasi bukti menggunakan live status.

## Pemeriksaan yang sudah dilakukan

- Audit statis struktur dialog, label form, target sentuh, dan reduced motion.
- ESLint untuk mendeteksi masalah React dan markup yang didukung konfigurasi proyek.
- TypeScript dan production build.

## Manual QA yang wajib dilakukan

### Keyboard

1. Tekan Tab dari awal halaman dan pastikan skip link muncul serta memindahkan fokus ke konten utama.
2. Buka menu mobile, notifikasi, filter, dan form aset menggunakan keyboard.
3. Pastikan Tab dan Shift+Tab tetap berada di dialog.
4. Tekan Escape, pastikan dialog tertutup dan fokus kembali ke tombol pembuka.
5. Pastikan semua tombol pilihan risiko dan jawaban checklist memiliki indikator fokus.

### Screen reader

1. Uji Chrome + NVDA atau Safari + VoiceOver.
2. Pastikan judul halaman, landmark, status koneksi, pesan error, progres upload, dan keputusan Safety Gate dibacakan dengan konteks yang benar.
3. Pastikan label setiap input laporan dan checklist terbaca sebelum nilai field.
4. Pastikan status warna juga memiliki label teks dan tidak bergantung pada warna saja.

### Reflow dan visual

1. Uji lebar 320px dan zoom browser 200%.
2. Pastikan tidak ada kontrol, dialog, atau teks yang terpotong.
3. Uji mode reduced motion dan pastikan background serta transisi tidak bergerak terus-menerus.
4. Verifikasi kontras aktual menggunakan Accessibility panel atau axe pada browser.

## Batasan

Tidak ada dependency axe/pa11y yang ditambahkan pada fase ini. Automated browser scan dan pengujian screen reader masih harus dilakukan pada environment yang memiliki akun Supabase serta data uji yang sesuai.
