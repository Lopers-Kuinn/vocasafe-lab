# Audit K3 Digital V2

Audit K3 V2 membedakan dua kebutuhan:

1. **Live performance view** untuk monitoring operasional berdasarkan data yang saat ini dapat dibaca oleh RLS pengguna.
2. **Immutable audit snapshot** untuk menyimpan ruang lingkup, periode, kriteria, metodologi, indikator, temuan, rekomendasi, dan sign-off pada satu titik waktu.

## Dasar rancangan

- Panduan SMK3L Perguruan Tinggi 2024: audit berkala, sistematis, oleh personel kompeten, didokumentasikan, dan digunakan untuk tindakan perbaikan serta tinjauan manajemen.
- PP Nomor 50 Tahun 2012: pemantauan, pelaporan, perbaikan kekurangan, pemeriksaan SMK3, dan penggunaan data.
- ISO 45004:2024: monitoring, measurement, analysis, evaluation, dan indikator kinerja K3.
- Leading indicator: waktu respons, inspeksi tepat waktu, penyelesaian tindakan korektif, preventive maintenance, dan kecukupan bukti.
- Hierarchy of Controls: eliminasi, substitusi, rekayasa teknik, administratif, lalu APD.

Dokumen ini adalah panduan implementasi aplikasi, bukan pengganti interpretasi hukum atau audit oleh auditor K3 yang kompeten.

## Fitur live audit

- Scope per laboratorium dan rentang tanggal.
- Summary aset, laporan, checklist, risiko, bahaya aktif, inspeksi, work order, sertifikat, dan corrective action.
- Leading indicator:
  - median waktu respons laporan;
  - median waktu penutupan;
  - kepatuhan jadwal inspeksi;
  - corrective action tepat waktu;
  - cakupan bukti;
  - temuan berulang.
- Tren enam bulan laporan, checklist, dan risiko tinggi/kritis.
- Temuan prioritas dengan sumber, PIC, due date, status, serta link ke bukti operasional.
- Rekomendasi rule-based yang memprioritaskan hierarchy of controls.
- Pemeriksaan konsistensi risk score dan konteks data.
- CSV dan print dinonaktifkan bila sumber data tidak lengkap.

## Migration 013

File `supabase/migrations/013_audit_k3_v2.sql` harus direview dan dijalankan manual setelah migration 009–012 telah aktif.

Migration membuat:

- `audit_runs`: metadata dan snapshot JSONB immutable;
- `audit_findings`: temuan yang disalin dari sumber operasional pada saat snapshot;
- `audit_signoffs`: catatan review dan approval;
- RPC `create_audit_snapshot(...)`;
- RPC `signoff_audit_run(...)`.

Migration tidak menggunakan service role, tidak menonaktifkan RLS, dan tidak memberi akses tulis langsung kepada client. Pembuatan snapshot dan sign-off hanya dilakukan melalui RPC tervalidasi.

## Otorisasi

- Teknisi: melihat audit scope laboratoriumnya dan membuat draft snapshot.
- Kepala laboratorium: melihat scope laboratoriumnya, membuat draft, meninjau, dan menyetujui snapshot.
- Admin: melihat/membuat audit lintas laboratorium atau per laboratorium serta melakukan review/approval.
- Mahasiswa dan dosen: tidak memperoleh route audit formal.

Snapshot global tanpa `laboratory_id` hanya dapat dibuat dan dibaca admin.

Route `/audit/[id]` menampilkan isi snapshot, hash, temuan, rekomendasi, dan riwayat sign-off sebelum keputusan review/approval diberikan.

Pemisahan tugas diterapkan pada RPC:

- pembuat snapshot tidak boleh me-review atau menyetujui snapshotnya sendiri;
- reviewer tidak boleh menjadi approver untuk snapshot yang sama;
- audit satu laboratorium dapat dieskalasikan kepada penanggung jawab berwenang lain pada scope yang sama atau admin untuk memenuhi pemisahan tugas.

## Integritas data

- Risk score tetap dihitung dari `severity × probability × exposure`.
- Audit tidak menulis atau mengubah report/checklist/aset sumber.
- Snapshot menyimpan ID sumber dan metrik pada saat dibuat.
- Snapshot yang sudah dibuat tidak dapat diedit melalui client.
- Setiap snapshot memperoleh hash stabil atas payload yang disimpan.
- Sign-off hanya mengubah status audit, bukan isi snapshot.
- Bila satu sumber data gagal dimuat, UI menandai laporan tidak lengkap dan memblokir export, print, serta snapshot.

## Runtime test setelah migration

1. Login teknisi dan buka `/audit`.
2. Pastikan scope otomatis mengikuti laboratorium teknisi.
3. Uji filter 30 hari, 90 hari, tahun berjalan, semua data, dan custom.
4. Pastikan angka laporan/checklist berubah sesuai periode.
5. Pastikan temuan prioritas membuka detail sumber yang benar.
6. Pastikan CSV memuat metadata scope dan data laporan/checklist/tindakan/work order.
7. Pastikan print preview tidak kosong dan kontrol interaktif disembunyikan.
8. Simpan snapshot sebagai teknisi; pastikan status `draft`.
9. Login kepala laboratorium pada lab yang sama; tandai snapshot `reviewed`, lalu `approved`.
10. Pastikan kepala laboratorium lain tidak dapat membaca atau menandatangani snapshot tersebut.
11. Login admin; pastikan audit global dapat dibuat.
12. Simulasikan kegagalan salah satu sumber data dan pastikan export/print/snapshot dinonaktifkan.
