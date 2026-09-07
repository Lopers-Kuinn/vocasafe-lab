# Pengujian

## Automated validation

```bash
npm run typecheck
npm run lint
npm run build
```

Semua perintah harus lulus pada commit yang diajukan kepada juri.

## Smoke test utama

1. Login dan logout dengan session Supabase.
2. Verifikasi redirect route sesuai role.
3. Buka dashboard dan cocokkan ringkasan dengan data Supabase.
4. Scan `AST-001`, payload `vocasafe://assets/AST-001`, dan kode tidak dikenal.
5. Buka detail aset, SOP, status operasional, QR, dan riwayat.
6. Buat laporan 5 × 4 × 5 dan pastikan skor 100/kritis.
7. Ambil foto melalui kamera dan pilih foto melalui galeri.
8. Verifikasi upload private dan signed URL.
9. Tambahkan acknowledgement, assignment, tenggat, status, dan follow-up.
10. Buat checklist risiko dan checklist tanpa risiko.
11. Pastikan dashboard serta audit membaca data baru.
12. Export CSV dan buka print preview.

## Reliability mobile

- Uji lebar 320 px dan 390 px.
- Uji Android Chrome dan iPhone Safari.
- Uji koneksi normal, lambat, offline, lalu online.
- Reload ketika submission masih antre dan pastikan data tetap tersedia.
- Pastikan retry menghasilkan tepat satu report/checklist dan satu attachment.
- Pastikan kamera dapat dihentikan dan diganti ketika beberapa kamera tersedia.

## Accessibility

- Navigasikan alur utama dengan keyboard.
- Pastikan skip link, focus indicator, focus trap, Escape, dan focus restoration bekerja.
- Uji zoom 200% serta `prefers-reduced-motion`.
- Uji alur kritis dengan NVDA atau VoiceOver.
- Status tidak boleh disampaikan hanya melalui warna.

## Security regression

- User tanpa session, profil, atau akun aktif ditolak.
- Mahasiswa, dosen, teknisi, kepala lab, dan admin hanya melihat route yang diizinkan.
- Pengelola satu laboratorium tidak melihat data laboratorium lain.
- Attachment dan signed URL tidak tersedia untuk akun tanpa hak.
- `.env.local` dan secret tidak tracked.
- AI tidak mengubah skor atau menyimpan metadata otomatis.

## Status validasi

Alur teknis utama telah diuji selama pengembangan. Pengujian pengguna nyata pada perangkat target tetap diperlukan sebelum penggunaan operasional. Hasil pengujian lapangan harus mencatat role, perangkat, waktu tugas, bantuan, kegagalan, dan bukti tanpa menyimpan data pribadi atau secret.
