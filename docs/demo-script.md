# Skenario Demo VocaSafe Lab

Target durasi: sekitar 3–4 menit.

## Persiapan

- Gunakan project Supabase khusus demo dengan data sintetis.
- Pastikan migration 001–015, seed, bucket private, dan akun demo tersedia.
- Gunakan koneksi stabil dan siapkan input kode sebagai fallback kamera.
- Jangan menampilkan dashboard Supabase, `.env.local`, password, atau API key.

## Alur demo

### 1. Scan aset

Login sebagai mahasiswa, buka Scan QR, lalu pindai atau masukkan `AST-001`. Jelaskan bahwa QR menghubungkan identitas aset dengan catatan keselamatannya.

### 2. Safety Gate dan SOP

Tunjukkan status operasional, kelayakan, alasan pembatasan bila ada, PIC, kontak laboratorium, dan SOP. Tekankan bahwa QR tidak menggantikan pemeriksaan fisik dan LOTO.

### 3. Laporan bahaya

Buat laporan kondisi kabel terkelupas. Isi severity 5, probability 4, dan exposure 5. Tunjukkan skor 100 dengan kategori kritis serta foto bukti.

### 4. Saran AI

Minta analisis risiko. Jelaskan bahwa AI memberi saran yang harus ditinjau, sedangkan skor final selalu dihitung dengan aturan yang sama. Terapkan atau ubah saran sebelum submit.

### 5. Respons petugas

Masuk sebagai teknisi/admin. Akui laporan, tentukan petugas dan tenggat, lalu tambahkan follow-up serta status penanganan. Reload untuk menunjukkan persistensi riwayat.

### 6. Checklist

Masuk sebagai dosen. Tunjukkan navigator item, satu temuan kritis, catatan, bukti, dan hasil checklist.

### 7. Monitoring dan audit

Masuk sebagai kepala laboratorium/admin. Tunjukkan dashboard berdasarkan role, laporan kritis, tren, audit, export CSV, dan print preview.

## Penutup

VocaSafe Lab mengubah temuan lapangan menjadi keputusan risiko yang konsisten, tindakan yang dapat ditelusuri, dan bukti audit dalam satu alur digital.
