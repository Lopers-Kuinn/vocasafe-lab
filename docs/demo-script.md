# Demo Script VocaSafe Lab

Dokumen ini berisi skenario demo langkah demi langkah untuk presentasi VocaSafe Lab.

## Persiapan Demo

1. Jalankan aplikasi lokal dengan `npm run dev`.
2. Buka aplikasi di browser.
3. Pastikan environment Supabase yang dipakai demo sudah aktif. Route utama membaca data dari Supabase; localStorage hanya artefak legacy/non-runtime.
4. Gunakan resolusi desktop untuk demo utama, lalu tunjukkan tampilan mobile bila diperlukan.

## Skenario Demo Utama

### 1. Buka Aplikasi

1. Buka halaman awal aplikasi.
2. Jelaskan bahwa VocaSafe Lab adalah prototype audit K3 dan manajemen risiko laboratorium vokasi.
3. Klik tombol masuk ke sistem.

### 2. Login Sebagai Admin

1. Login dengan akun Supabase ber-role **Admin Sistem**.
2. Masuk ke dashboard.
3. Jelaskan bahwa admin memiliki akses penuh untuk demo.

### 3. Tampilkan Dashboard

1. Tunjukkan kartu ringkasan:
   - Total laporan
   - Risiko kritis
   - Belum selesai
2. Tunjukkan ringkasan risiko berdasarkan kategori.
3. Tunjukkan daftar laporan terbaru.
4. Jelaskan bahwa dashboard membaca ringkasan live dari Supabase sesuai scope laboratorium pengguna.

### 4. Tampilkan Data Asset

1. Buka menu **Aset**.
2. Tunjukkan daftar alat/fasilitas.
3. Jelaskan status asset seperti aman, perlu pemeriksaan, dan tidak layak pakai.

### 5. Buka Detail Asset AST-001

1. Pilih asset **AST-001 / Mesin Bor Duduk 01**.
2. Tunjukkan detail asset:
   - Kode asset
   - Lokasi
   - Status kelayakan
   - Jadwal inspeksi

### 6. Tunjukkan QR Code dan SOP

1. Scroll ke bagian QR Code.
2. Jelaskan bahwa QR Code mewakili identitas asset.
3. Tunjukkan SOP digital yang berisi APD dan langkah kerja aman.

### 7. Login Sebagai Mahasiswa

1. Klik keluar.
2. Login ulang sebagai **Mahasiswa**.
3. Jelaskan bahwa mahasiswa dapat scan QR, melihat asset, dan membuat laporan bahaya.

### 8. Simulasikan Scan QR

1. Buka menu **Scan QR**.
2. Pilih atau masukkan `vocasafe://assets/AST-001` atau `AST-001`.
3. Buka detail asset dari hasil simulasi scan.

### 9. Buat Laporan Bahaya Dari AST-001

1. Dari detail asset AST-001, klik **Laporkan Bahaya**.
2. Pastikan form laporan terbuka dengan asset AST-001 otomatis terpilih.
3. Isi judul laporan, misalnya: `Pelindung mesin tidak stabil`.
4. Isi deskripsi singkat bahaya.

### 10. Isi Risk Scoring

1. Set nilai:
   - Severity: 5
   - Probability: 4
   - Exposure: 5
2. Tunjukkan skor:
   - Score: 100
   - Category: kritis
3. Jelaskan rumus:

```text
Risk Score = Severity x Probability x Exposure
5 x 4 x 5 = 100
```

### 11. Submit Laporan

1. Klik **Kirim Laporan**.
2. Pastikan laporan baru tampil di halaman daftar laporan.
3. Jelaskan bahwa laporan tersimpan di Supabase dan dilindungi RLS.

### 12. Login Sebagai Teknisi

1. Klik keluar.
2. Login sebagai **Teknisi/Laboran**.
3. Buka menu **Laporan**.
4. Buka laporan baru yang dibuat mahasiswa.

### 13. Ubah Status Menjadi Dalam Penanganan

1. Di panel tindak lanjut, pilih status **Dalam Penanganan**.
2. Isi catatan tindak lanjut, misalnya: `Mesin diberi label larangan operasi dan dijadwalkan pemeriksaan.`
3. Simpan tindak lanjut.
4. Refresh halaman bila perlu untuk menunjukkan status tetap konsisten.

### 14. Login Sebagai Dosen

1. Klik keluar.
2. Login sebagai **Dosen**.
3. Buka menu **Checklist**.
4. Klik **Isi Checklist**.

### 15. Isi Checklist K3

1. Pilih template checklist.
2. Pilih asset.
3. Jawab item checklist dengan Ya/Tidak/N/A.
4. Aktifkan **Ada temuan risiko?** jika ingin menunjukkan risk scoring pada checklist.
5. Isi severity, probability, exposure.
6. Tunjukkan preview skor dan kategori.
7. Simpan hasil checklist.

### 16. Login Sebagai Kepala Laboratorium

1. Klik keluar.
2. Login sebagai **Kepala Laboratorium**.
3. Jelaskan bahwa kepala lab dapat melihat dashboard, asset, laporan, hasil checklist, dan audit; kepala lab tidak membuat laporan baru, tidak mengisi checklist, dan view-only untuk perubahan status laporan.

### 17. Buka Audit Report

1. Buka menu **Audit**.
2. Tunjukkan ringkasan audit:
   - Total laporan
   - Distribusi risiko
   - Distribusi status laporan
3. Tunjukkan tabel laporan.

### 18. Export CSV

1. Klik **Export CSV**.
2. Tunjukkan file yang dihasilkan: `vocasafe-audit-report.csv`.
3. Jelaskan bahwa export CSV dapat digunakan untuk rekap atau lampiran proposal.

### 19. Print / Save as PDF

1. Klik **Print / PDF**.
2. Browser membuka dialog print.
3. Pilih **Save as PDF** jika ingin menyimpan laporan audit sebagai PDF.
4. Jelaskan bahwa prototype tidak memakai library PDF eksternal.

## Penutup Demo

Akhiri demo dengan menekankan manfaat utama:

- Asset laboratorium terdokumentasi dengan SOP dan QR Code.
- Mahasiswa/dosen dapat melaporkan bahaya secara cepat.
- Teknisi dapat menindaklanjuti laporan dengan status yang tercatat.
- Kepala lab/admin dapat memantau risiko melalui dashboard dan audit report.
- Prototype sudah memakai Supabase untuk Auth, database, Storage evidence, RLS, dan audit; provider AI tetap opsional dengan fallback rule-based.
