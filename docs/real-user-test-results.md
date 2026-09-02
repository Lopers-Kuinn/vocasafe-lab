# Real-User Test Results — Template

Status dokumen: **Belum diuji**. Salin bagian sesi dan temuan sesuai kebutuhan. Jangan mengubah status menjadi lulus tanpa bukti sesi nyata.

## Ringkasan pelaksanaan

| Field | Nilai |
|---|---|
| Build/commit yang diuji | Belum diisi |
| URL environment | Belum diisi |
| Tanggal dan zona waktu | Belum diisi |
| Fasilitator | Belum diisi |
| Jumlah peserta | 0 |
| Device/browser tercakup | Belum diisi |
| Migration 014/015 terverifikasi | Belum diisi |
| Keputusan | NOT TESTED |

## Matriks peserta

| Kode | Role | Pengalaman | Perangkat/browser | Assistive technology | Persetujuan bukti |
|---|---|---|---|---|---|
| MHS-01 | Mahasiswa |  |  |  |  |
| MHS-02 | Mahasiswa |  |  |  |  |
| DSN-01 | Dosen |  |  |  |  |
| TKN-01 | Teknisi/Laboran |  |  |  |  |
| KPL-01 | Kepala Laboratorium |  |  |  |  |
| ADM-01 | Admin |  |  |  |  |

## Hasil tugas

Gunakan hasil `Lulus`, `Lulus dengan bantuan`, `Gagal`, atau `Tidak diuji`.

| Sesi | Task ID | Hasil | Waktu | Bantuan | Salah tekan/error | SEQ 1–7 | Bukti/ID data |
|---|---|---|---:|---:|---|---:|---|
|  | RT-MHS-01 | Tidak diuji |  |  |  |  |  |
|  | RT-MHS-02 | Tidak diuji |  |  |  |  |  |
|  | RT-DSN-01 | Tidak diuji |  |  |  |  |  |
|  | RT-TKN-01 | Tidak diuji |  |  |  |  |  |
|  | RT-KPL-01 | Tidak diuji |  |  |  |  |  |
|  | RT-ADM-01 | Tidak diuji |  |  |  |  |  |

## Temuan

| ID | Severity | Role/device | Langkah reproduksi | Dampak keselamatan/data | Bukti | Owner | Status |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |

## Pemeriksaan lintas role

| Pemeriksaan | Hasil | Bukti/catatan |
|---|---|---|
| Reporter hanya melihat laporan yang diizinkan | Belum diuji |  |
| Pengelola tidak melihat laboratorium lain | Belum diuji |  |
| Route terlarang ditolak sesuai role | Belum diuji |  |
| Signed URL tidak tersedia untuk user tidak berhak | Belum diuji |  |
| Admin self-protection bekerja | Belum diuji |  |

## Reliability dan accessibility

| Pemeriksaan | Hasil | Bukti/catatan |
|---|---|---|
| Offline report menjadi tepat satu data setelah reconnect | Belum diuji |  |
| Offline checklist menjadi tepat satu data setelah reconnect | Belum diuji |  |
| Foto kamera dan galeri tetap utuh | Belum diuji |  |
| Keyboard dan focus trap | Belum diuji |  |
| Screen reader pada alur kritis | Belum diuji |  |
| 320 px, 390 px, zoom 200% | Belum diuji |  |
| Reduced motion | Belum diuji |  |

## Skor akhir

| Metrik | Aktual | Target | Lulus |
|---|---:|---:|---|
| Penyelesaian tugas tanpa bantuan | Belum dihitung | >= 90% | Belum |
| Keputusan keselamatan kritis benar | Belum dihitung | 100% | Belum |
| Kehilangan draft/bukti | Belum dihitung | 0 | Belum |
| Duplikasi retry | Belum dihitung | 0 | Belum |
| Median waktu scan-keputusan | Belum dihitung | <= 30 detik | Belum |
| Median waktu laporan | Belum dihitung | <= 3 menit | Belum |
| Median waktu checklist | Belum dihitung | <= 6 menit | Belum |
| Median SEQ | Belum dihitung | >= 5/7 | Belum |
| SUS | Belum dihitung | >= 75/100 | Belum |

## Keputusan release

- [ ] Seluruh peserta minimum selesai diuji.
- [ ] Tidak ada Blocker/Critical terbuka.
- [ ] Seluruh Major telah diperbaiki dan diverifikasi atau pilot ditunda.
- [ ] Tidak ada kehilangan/duplikasi data.
- [ ] Isolasi role/laboratorium lulus.
- [ ] Accessibility manual lulus.
- [ ] `git diff --check`, typecheck, lint, dan build lulus.

Keputusan akhir: **NOT TESTED**

Alasan dan approver:

> Belum diisi.

