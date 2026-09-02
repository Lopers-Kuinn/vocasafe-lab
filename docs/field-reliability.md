# Field Reliability

Phase ini menjaga laporan dan checklist ketika koneksi lapangan terputus.

## Perilaku

- Teks form tetap disimpan sebagai draft lokal.
- Bukti foto disimpan di IndexedDB per akun pengguna.
- Submit ketika offline masuk ke outbox lokal.
- Outbox diproses saat browser kembali online dan setiap 30 detik selama aplikasi terbuka.
- Report menggunakan UUID pengiriman tetap sebagai primary key.
- Checklist menggunakan RPC idempotensi pada migration 014.
- Bukti memakai UUID dan path tetap sehingga retry tidak mengunggah file yang sama berulang kali.
- Data antrean milik akun lain tidak diproses ketika perangkat berganti pengguna.

## Migration wajib

Jalankan `supabase/migrations/014_field_submission_idempotency.sql` secara manual melalui Supabase SQL Editor sebelum menguji offline checklist.

Migration menambahkan `client_submission_id` pada `checklist_results`, unique index per pemeriksa, dan RPC `submit_checklist_result_idempotent`. Migration tidak mengubah rumus risk scoring atau role access.

## Batasan browser

Sinkronisasi berjalan ketika aplikasi terbuka atau ketika event `online` diterima. Browser dapat menunda JavaScript pada tab yang benar-benar dihentikan. Antrean tetap tersimpan dan dilanjutkan saat aplikasi dibuka kembali.

## Runtime test

1. Login dengan role yang boleh membuat laporan.
2. Isi laporan beserta foto, aktifkan mode offline, lalu submit.
3. Pastikan status menunjukkan satu data menunggu sinkronisasi.
4. Aktifkan koneksi dan pilih coba sinkronkan.
5. Pastikan tepat satu report dan satu metadata attachment tersimpan.
6. Ulangi untuk checklist setelah migration 014 diterapkan.
7. Reload browser sebelum koneksi dipulihkan dan pastikan antrean tetap tersedia.
