# QR Safety Gate VocaSafe Lab

## Tujuan

QR aset adalah pintu masuk ke data K3 terkini, bukan pengganti inspeksi,
pengaman mesin, rambu fisik, atau prosedur Lockout/Tagout (LOTO).

Setelah QR dipindai, aplikasi menampilkan salah satu keputusan berikut:

- `clear`: status tercatat layak; aset tetap harus digunakan sesuai SOP, APD,
  dan kewenangan operator;
- `restricted`: penggunaan dibatasi dan memerlukan konfirmasi laboran;
- `blocked`: jangan digunakan sampai dinyatakan aman oleh petugas berwenang;
- `unverified`: data terkini tidak dapat diverifikasi dan aplikasi berlaku
  fail-safe dengan melarang keputusan penggunaan berbasis data lama.

## Identitas QR permanen

QR baru menggunakan URL HTTPS dengan UUID aset:

```text
https://<domain-vocasafe>/scan?asset=<asset-uuid>
```

UUID tidak berubah ketika kode, nama, atau lokasi aset diperbarui. Kode seperti
`AST-001` tetap dicetak untuk pembacaan manual dan payload legacy
`vocasafe://assets/AST-001` tetap diterima oleh scanner internal.

URL dari domain lain ditolak. Setelah login, parameter tujuan dipertahankan agar
pengguna kembali ke Safety Gate yang dipindai.

## Data yang memengaruhi keputusan

Ringkasan database memeriksa:

- status kelayakan dan status operasional aset;
- jadwal inspeksi;
- sertifikat atau kalibrasi kedaluwarsa dan jatuh tempo;
- kontrol keselamatan yang tidak berfungsi;
- work order terbuka;
- laporan kritis yang belum selesai;
- rekomendasi hasil inspeksi yang belum direview.

RPC hanya mengembalikan hitungan dan status yang diperlukan. Detail laporan
tetap dilindungi RLS masing-masing resource.

## Audit dan privasi

Migration 011 membuat `asset_scan_events` dengan data minimal:

- aset dan laboratorium;
- pengguna yang melakukan scan;
- sumber scan: kamera, input manual, atau tautan QR;
- keputusan Safety Gate;
- waktu scan.

Frame kamera, foto, dan payload mentah tidak disimpan. Data hanya dapat dibaca
oleh pengelola laboratorium terkait atau admin. Tetapkan retensi operasional,
misalnya 90 hari, sebelum penggunaan produksi jangka panjang.

## Label fisik

Label cetak memuat nama aset, kode, laboratorium, lokasi, kontak darurat, domain
resmi, dan instruksi memeriksa status K3 live. Gunakan bahan yang sesuai kondisi
lingkungan serta segel anti-tamper bila tersedia.

QR tidak menggantikan:

- label merah `Jangan Digunakan`;
- isolasi energi dan LOTO;
- rambu bahaya;
- nameplate atau identitas teknis pabrikan;
- persetujuan return-to-service oleh petugas berwenang.

## Hak akses

Mahasiswa, dosen, teknisi/laboran, dan admin dapat membuka Safety Gate. Kepala
laboratorium tidak membuka route `/scan`; aksesnya tetap mengikuti matriks role
aplikasi. Pembuatan laporan dan checklist mengikuti matriks role aplikasi.

## Migration

Review lalu jalankan secara manual setelah migration 010:

```text
supabase/migrations/011_qr_scan_safety_gate.sql
```

Jika migration belum diterapkan, Safety Gate menampilkan status `unverified`
dan tidak menyatakan aset layak digunakan.
