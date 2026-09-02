# Field Interaction Phase

Fase ini memprioritaskan interaksi yang paling sering dilakukan pengguna ketika bekerja langsung di laboratorium melalui ponsel. Perubahan tidak mengubah rumus penilaian risiko, hak akses, atau sumber data Supabase.

## Foto bukti dari lapangan

- Form laporan dan checklist tetap menyediakan dua jalur: ambil foto langsung dari kamera dan pilih foto dari galeri.
- Foto berukuran lebih dari 1,5 MB dioptimalkan di browser sebelum masuk antrean lokal atau Supabase Storage.
- Sisi terpanjang foto diperkecil hingga maksimum 1.600 piksel dan hasilnya dikodekan sebagai WebP. Kualitas diturunkan bertahap hanya bila diperlukan.
- File mentah dibatasi 20 MB. File hasil akhir tetap mengikuti batas upload bukti 5 MB.
- Optimasi tidak mengunggah foto ke layanan lain. Proses berlangsung pada perangkat pengguna.
- Jika `createImageBitmap` atau Canvas tidak tersedia atau gagal, file asli dipertahankan. Validasi ukuran akhir tetap mencegah upload yang melebihi batas.

## Respons setelah scan

- Hasil scan menampilkan keputusan keselamatan aset sebelum tombol tindakan lain.
- Bila nomor darurat laboratorium tersedia, tombol **Hubungi Kontak Lab** menggunakan tautan `tel:` agar pengguna lapangan dapat langsung membuka aplikasi telepon.
- Untuk aset yang dibatasi atau dilarang digunakan, tombol kontak dibuat lebih menonjol. QR tetap menjadi akses informasi dan tidak menggantikan rambu fisik, SOP, atau prosedur LOTO.

## Navigasi checklist mobile

- Navigator item menampilkan jumlah pertanyaan yang belum dijawab dan jumlah temuan.
- Tombol **Belum dijawab** dan **Temuan** memindahkan pengguna ke item pertama yang relevan.
- Nomor item dapat digeser secara horizontal dan memiliki status visual: abu-abu untuk belum dijawab, hijau untuk sudah dijawab, dan merah untuk temuan.
- Setiap nomor memiliki label aksesibilitas yang menjelaskan nomor, nama item, dan status jawabannya.

## Target sentuh

Kontrol utama pada alur scan, pengambilan foto, navigasi checklist, dan pengiriman form memiliki tinggi minimum 48 piksel. Ukuran ini membantu penggunaan dengan sarung tangan tipis atau satu tangan dan mengurangi salah tekan pada layar kecil.

## Runtime test yang disarankan

Lakukan pengujian melalui HTTPS pada ponsel nyata:

1. Ambil foto berukuran lebih dari 1,5 MB, pastikan proses selesai dan file dapat dikirim.
2. Pilih foto dari galeri, lalu pastikan pratinjau dan tombol hapus bekerja.
3. Matikan jaringan setelah foto dipilih, kirim form, lalu pastikan antrean lokal mempertahankan bukti hingga sinkronisasi berhasil.
4. Scan aset yang memiliki nomor kontak dan pastikan tombol telepon membuka dialer dengan nomor yang benar.
5. Isi checklist secara tidak berurutan dan pastikan navigator menunjukkan item belum dijawab serta temuan dengan benar.
6. Uji pada lebar 390 piksel dan pastikan tidak ada tombol yang tertutup navigasi bawah.

## Batasan

- Kompresi foto tidak menggantikan pemeriksaan kualitas bukti oleh petugas.
- Dukungan kamera, format gambar, dan pembukaan aplikasi telepon bergantung pada browser serta perangkat.
- Fase ini tidak menambah dependency, migration database, atau perubahan kebijakan RLS.
