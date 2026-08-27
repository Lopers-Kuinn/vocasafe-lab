# AGENTS.md — VocaSafe Lab Vibe Coding Operating Manual

> **Tujuan dokumen ini:** menjadi instruksi utama untuk AI coding agent apa pun, termasuk Codex, Claude Code, Cursor, Windsurf, Qoder, Copilot, atau ChatGPT.  
> **Cara pakai:** simpan file ini di root project sebagai `AGENTS.md`. Jika agent tidak otomatis membaca `AGENTS.md`, paste isi dokumen ini sebagai konteks awal sebelum memberi task.

---

## 0. Status Dokumen

- **Project:** VocaSafe Lab
- **Jenis:** Responsive web app + mobile web prototype
- **Target:** Demo hackathon dan bahan screenshot/mockup proposal
- **Stack saat ini:** Next.js App Router + TypeScript + Tailwind CSS + localStorage
- **Backend saat ini:** dummy data + localStorage
- **Belum digunakan:** Supabase, API AI, upload server, storage, kamera QR sungguhan, library PDF eksternal
- **Status MVP:** Task 1 sampai Task 10 selesai
- **Status QA:** Final QA menemukan 2 masalah Major yang harus diperbaiki sebelum deploy
- **Aturan utama:** jangan menambah fitur baru sebelum bug Major selesai dan Final QA ulang lulus

---

## 1. Prinsip Kerja Agent

AI agent harus bekerja seperti engineer profesional, bukan generator kode bebas.

### 1.1 Aturan wajib

1. **Baca dokumen ini dulu.**
2. **Inspeksi file terkait sebelum membuat klaim.**
3. **Jangan berasumsi struktur file, nama tipe, nama route, atau key localStorage tanpa membaca source code.**
4. **Kerjakan satu task kecil per instruksi.**
5. **Jangan membuat fitur di luar scope task.**
6. **Jangan mengganti arsitektur tanpa izin.**
7. **Jangan menghapus file yang belum dipastikan tidak digunakan.**
8. **Jangan mengubah role access kecuali task secara eksplisit meminta atau ada bug langsung terkait.**
9. **Jangan mengubah rumus risk scoring.**
10. **Jangan mengintegrasikan Supabase, API AI, kamera QR, storage, atau PDF library sampai user meminta.**
11. **Jangan menyatakan build/typecheck lulus kecuali benar-benar dijalankan.**
12. **Jika task ambigu, berhenti dan tanyakan klarifikasi.**

### 1.2 Mode kerja

#### Review mode

Dipakai ketika user meminta review, audit, atau cek hasil.

- Jangan mengubah kode.
- Baca file terkait.
- Jalankan command validasi bila diminta.
- Laporkan temuan sebagai Critical, Major, Minor.
- Berikan file dan lokasi yang perlu diperbaiki.
- Jangan langsung memperbaiki.

#### Execution mode

Dipakai ketika user meminta perbaikan atau implementasi.

- Ubah kode seminimal mungkin.
- Jangan refactor besar kecuali perlu.
- Jangan menambah fitur di luar scope.
- Setelah selesai, jalankan validasi.
- Laporkan file yang diubah dan alasan perubahan.

---

## 2. Definisi Vibe Coding untuk Project Ini

Vibe coding pada project ini berarti:

- User memberi arah produk, alur demo, batasan, dan kriteria sukses.
- AI membantu menulis kode, memperbaiki bug, dan menyusun dokumentasi.
- AI tidak boleh mengambil keputusan besar sendiri.
- Setiap perubahan harus bisa dijelaskan dan diuji.

### 2.1 Vibe produk

VocaSafe Lab harus terasa aman, profesional, akademik, bersih, data-driven, mudah dipakai di laboratorium vokasi, nyaman di desktop dan mobile.

### 2.2 Batasan vibe

Jangan membuat UI yang terlalu ramai, terlalu futuristik, atau tidak cocok untuk proposal akademik.

Gunakan gaya visual yang stabil:

- warna utama: emerald, teal, putih, slate,
- risiko rendah: hijau,
- risiko sedang: kuning,
- risiko tinggi: oranye,
- risiko kritis: merah.

---

## 3. Ringkasan Project

### 3.1 Nama produk

**VocaSafe Lab**

### 3.2 Deskripsi produk

VocaSafe Lab adalah sistem audit K3 dan manajemen risiko laboratorium vokasi berbasis QR Code dan AI-Assisted Risk Scoring. Prototype saat ini menggunakan rule-based scoring, dummy data, dan localStorage.

### 3.3 Tujuan MVP

MVP harus mendemonstrasikan:

1. Login role dummy.
2. Dashboard monitoring.
3. Data alat/fasilitas.
4. Detail asset + SOP digital + QR Code.
5. Simulasi scan QR.
6. Form laporan bahaya/kerusakan.
7. Risk scoring: severity × probability × exposure.
8. Daftar laporan.
9. Detail laporan.
10. Tindak lanjut laporan oleh teknisi/admin.
11. Checklist K3.
12. Audit report.
13. Export CSV.
14. Print/save as PDF via `window.print()`.
15. Responsive desktop dan mobile.

---

## 4. Stack dan Batasan Teknis

### 4.1 Stack saat ini

- Next.js App Router
- TypeScript
- Tailwind CSS
- lucide-react
- qrcode.react
- localStorage untuk data prototype

### 4.2 Belum boleh digunakan

Jangan menambahkan hal berikut tanpa izin:

- Supabase
- Firebase
- API AI
- OpenAI API
- kamera/browser camera API
- QR scanner library
- upload file sungguhan
- Supabase Storage
- server/database
- library PDF eksternal
- chart library eksternal
- authentication production

### 4.3 Client/server rule

Karena project memakai Next.js App Router:

- `localStorage` hanya boleh diakses di Client Component.
- File yang memakai `localStorage`, `window`, `document`, event handler, atau state React harus memiliki `"use client"`.
- Jangan akses `localStorage` di Server Component.
- Hindari hydration mismatch dengan membaca localStorage setelah mount atau melalui helper client-safe.

---

## 5. Source of Truth

Sebelum mengubah sesuatu, baca file aktual. Jangan hanya mengandalkan dokumen ini jika source code berbeda.

### 5.1 File penting

- `src/types/index.ts`
- `src/data/dummy-data.ts`
- `src/lib/risk-scoring.ts`
- `src/lib/report-storage.ts`
- `src/lib/checklist-storage.ts`
- `src/lib/role-access.ts`
- `src/lib/auth.ts`
- `src/app/dashboard/page.tsx`
- `src/components/reports/FollowUpPanel.tsx`
- `src/app/reports/page.tsx`
- `src/app/audit/page.tsx`

### 5.2 Jika ada konflik

Urutan prioritas:

1. Instruksi user terbaru.
2. Dokumen ini.
3. Source code aktual.
4. Dokumentasi resmi framework/library.
5. Asumsi agent.

Jika masih konflik, berhenti dan tanya user.

---

## 6. Route Project

Route yang harus ada dan tetap stabil:

| Route | Fungsi | Status |
|---|---|---|
| `/` | Landing page | Aktif |
| `/login` | Dummy login role | Aktif |
| `/dashboard` | Dashboard monitoring | Aktif |
| `/assets` | Daftar alat/fasilitas | Aktif |
| `/assets/[id]` | Detail asset, SOP, QR Code | Aktif |
| `/scan` | Simulasi scan QR | Aktif |
| `/reports` | Daftar laporan | Aktif |
| `/reports/new` | Form laporan bahaya | Aktif |
| `/reports/[id]` | Detail laporan + tindak lanjut | Aktif |
| `/checklists` | Daftar checklist K3 | Aktif |
| `/checklists/new` | Form checklist K3 | Aktif |
| `/audit` | Audit report + export | Aktif |

Jangan mengubah nama route tanpa izin.

---

## 7. Role dan Hak Akses

### 7.1 Role

Gunakan role canonical dari `src/types/index.ts`. Umumnya:

- `mahasiswa`
- `dosen`
- `teknisi`
- `kepala_lab`
- `admin`

Label Bahasa Indonesia:

| Value | Label |
|---|---|
| `mahasiswa` | Mahasiswa |
| `dosen` | Dosen |
| `teknisi` | Teknisi/Laboran |
| `kepala_lab` | Kepala Laboratorium |
| `admin` | Admin Sistem |

### 7.2 Matrix akses route

| Route | Mahasiswa | Dosen | Teknisi | Kepala Lab | Admin |
|---|---:|---:|---:|---:|---:|
| `/dashboard` | Ya | Ya | Ya | Ya | Ya |
| `/scan` | Ya | Ya | Ya | Tidak | Ya |
| `/assets` | Ya | Ya | Ya | Ya | Ya |
| `/assets/[id]` | Ya | Ya | Ya | Ya | Ya |
| `/reports` | Ya | Ya | Ya | Ya | Ya |
| `/reports/new` | Ya | Ya | Ya | Tidak | Ya |
| `/reports/[id]` | Ya | Ya | Ya | Ya | Ya |
| `/checklists` | Tidak | Ya | Ya | Tidak | Ya |
| `/checklists/new` | Tidak | Ya | Ya | Tidak | Ya |
| `/audit` | Tidak | Tidak | Ya | Ya | Ya |

### 7.3 Akses edit status laporan

Hanya role berikut boleh mengubah status laporan dan menambah tindak lanjut:

- `teknisi`
- `admin`

Role berikut hanya boleh melihat:

- `mahasiswa`
- `dosen`
- `kepala_lab`

Jangan mengubah aturan ini tanpa izin user.

---

## 8. Risk Scoring

### 8.1 Rumus wajib

```text
Risk Score = Severity × Probability × Exposure
```

### 8.2 Rentang input

Setiap faktor harus integer 1 sampai 5:

- `severity`: 1 sampai 5
- `probability`: 1 sampai 5
- `exposure`: 1 sampai 5

### 8.3 Kategori risiko

| Skor | Kategori |
|---:|---|
| 1-20 | rendah |
| 21-50 | sedang |
| 51-80 | tinggi |
| 81-125 | kritis |

### 8.4 Contoh wajib

```text
5 × 4 × 5 = 100
category = kritis
```

### 8.5 Rekomendasi

Gunakan rekomendasi dari `src/lib/risk-scoring.ts`. Jangan membuat rekomendasi baru yang bertentangan.

Expected wording:

| Kategori | Rekomendasi |
|---|---|
| rendah | Pantau kondisi secara berkala. |
| sedang | Jadwalkan pemeriksaan oleh teknisi atau laboran. |
| tinggi | Batasi penggunaan alat atau area sampai dilakukan pemeriksaan. |
| kritis | Hentikan penggunaan alat atau area sampai diperiksa dan diperbaiki oleh teknisi. |

---

## 9. Data dan localStorage

### 9.1 Sumber data prototype

Project memakai dua sumber data:

1. dummy data dari `src/data/dummy-data.ts`
2. localStorage dari browser

### 9.2 Key localStorage yang diketahui

| Key | Fungsi |
|---|---|
| `vocasafe_reports` | Laporan bahaya lokal |
| `vocasafe_checklists` | Checklist K3 lokal |

Untuk follow-up laporan, jangan menebak key. Baca helper yang sudah ada, kemungkinan di `src/lib/report-storage.ts`.

### 9.3 Aturan merge data

Untuk data gabungan:

1. Ambil dummy data.
2. Ambil data localStorage.
3. Gabungkan dengan `Map` berdasarkan `id`.
4. Jika ID sama, data localStorage boleh override dummy.
5. Urutkan terbaru di atas berdasarkan `createdAt` atau field tanggal yang tersedia.

### 9.4 Konsistensi antar halaman

Halaman berikut harus membaca laporan gabungan, bukan hanya dummy:

- `/reports`
- `/dashboard`
- `/audit`

Halaman berikut harus membaca checklist gabungan:

- `/checklists`
- `/audit`

Jika ada laporan baru dari `/reports/new`, maka harus terlihat dan terhitung di `/reports`, `/dashboard`, dan `/audit`.

Jika ada checklist baru dari `/checklists/new`, maka harus terlihat dan terhitung di `/checklists` dan `/audit`.

---

## 10. Status dan Label

### 10.1 Status laporan

Gunakan value canonical dari `src/types/index.ts`. Jangan menambahkan value baru tanpa izin.

Expected values:

- `baru`
- `diverifikasi`
- `dalam_penanganan`
- `selesai`
- `ditolak`

Jika source code memakai variant lain, jangan langsung mengganti semua. Baca dulu, lalu normalisasi secara hati-hati.

### 10.2 Label status laporan

| Value | Label |
|---|---|
| `baru` | Baru |
| `diverifikasi` | Diverifikasi |
| `dalam_penanganan` | Dalam Penanganan |
| `selesai` | Selesai |
| `ditolak` | Ditolak |

### 10.3 Status asset

Expected values:

- `layak`
- `perlu_dicek`
- `tidak_layak`

Label:

| Value | Label |
|---|---|
| `layak` | Layak |
| `perlu_dicek` | Perlu dicek |
| `tidak_layak` | Tidak layak |

### 10.4 Hasil checklist

Expected labels:

- Layak
- Perlu dicek
- Tidak layak

Aturan hasil checklist:

1. Jika ada item `Tidak layak`, hasil inspeksi = `Tidak layak`.
2. Jika tidak ada `Tidak layak` tetapi ada `Perlu dicek`, hasil inspeksi = `Perlu dicek`.
3. Jika semua relevan `Baik` atau `Tidak berlaku`, hasil inspeksi = `Layak`.

---

## 11. Known Issues Terbaru

Final QA menemukan 2 masalah Major. Ini harus diperbaiki sebelum deploy.

### 11.1 Major 1 — FollowUpPanel dropdown tidak sinkron

**File:** `src/components/reports/FollowUpPanel.tsx`

Masalah:

- Status dropdown tindak lanjut kembali ke `diverifikasi` setelah reload.
- Jika laporan sudah `dalam_penanganan`, dropdown tidak mengikuti `report.status`.
- Ini bisa menyebabkan status mundur saat catatan berikutnya disimpan.

Fix yang benar:

1. Initial state dropdown harus mengikuti `report.status`.
2. Jika `report.status` valid, gunakan itu.
3. Fallback hanya dipakai jika `report.status` kosong/invalid.
4. Setelah reload, dropdown tetap menampilkan status terakhir.
5. Saat simpan catatan lanjutan, status tidak boleh mundur.

Jangan memperbaiki dengan hardcode status tertentu.

### 11.2 Major 2 — Dashboard belum membaca laporan localStorage

**File:** `src/app/dashboard/page.tsx`

Masalah:

- `/reports` dan `/audit` membaca dummy + localStorage.
- Dashboard masih menghitung hanya `dummyReports`.
- Akibatnya total laporan dashboard tidak konsisten setelah user membuat laporan baru.

Fix yang benar:

1. Dashboard harus membaca dummyReports + `vocasafe_reports`.
2. Gabungkan tanpa duplikasi ID.
3. localStorage override dummy jika ID sama.
4. Hitung ulang total laporan, risiko kritis, menunggu tindak lanjut, distribusi risiko, laporan terbaru.
5. Dashboard harus konsisten dengan `/reports` dan `/audit`.

### 11.3 Minor yang boleh diperbaiki

- Hapus import ikon tidak terpakai di `ChecklistForm.tsx`.
- Perbaiki teks dashboard “Belum selesai atau ditolak” menjadi “Belum selesai” atau teks lain yang sesuai logika.
- Hapus `PlaceholderPage.tsx` hanya jika benar-benar tidak ada import.
- `@emnapi/runtime` extraneous tidak perlu diubah di code; bisa dibereskan dengan reinstall dependencies jika mengganggu.

---

## 12. Immediate Next Task

Task berikutnya adalah **Task 11.1 — Perbaikan Major Final QA**.

### Prompt siap pakai untuk AI agent

```text
Task 11.1: Perbaikan Major Final QA VocaSafe Lab.

Kondisi:
Final QA menemukan 2 masalah Major. Jangan menambah fitur baru. Fokus hanya memperbaiki inkonsistensi status tindak lanjut dan dashboard yang belum membaca laporan localStorage.

Masalah Major 1:
Di src/components/reports/FollowUpPanel.tsx, status dropdown tindak lanjut selalu kembali ke "diverifikasi" setelah reload, walaupun report.status sudah "dalam_penanganan" atau status lain. Ini berisiko membuat status laporan mundur saat teknisi/admin menyimpan catatan berikutnya.

Tugas:
1. Sinkronkan initial state dropdown dengan report.status.
2. Jika report.status tersedia dan valid, dropdown harus menggunakan status tersebut sebagai nilai awal.
3. Jika report.status tidak tersedia atau invalid, gunakan fallback aman.
4. Pastikan setelah reload, status dropdown mengikuti status laporan terakhir.
5. Jangan ubah behavior role access.
6. Jangan ubah localStorage key yang sudah ada kecuali benar-benar diperlukan.
7. Jangan ubah struktur besar report.

Masalah Major 2:
Dashboard di src/app/dashboard/page.tsx hanya membaca dummyReports. Setelah laporan lokal dibuat, /reports dan /audit membaca dummyReports + vocasafe_reports, tetapi dashboard tetap menampilkan data dari dummyReports saja.

Tugas:
1. Ubah dashboard agar membaca gabungan laporan dari dummyReports + localStorage vocasafe_reports.
2. Gunakan helper report-storage jika sudah ada.
3. Jika belum ada helper reusable yang sesuai, gunakan pola yang sama dengan /reports atau /audit.
4. Gabungkan data tanpa duplikasi ID.
5. localStorage boleh menjadi override terhadap dummy report jika ID sama.
6. Hitung ulang total laporan, risiko kritis, laporan menunggu tindak lanjut, ringkasan kategori risiko, dan laporan terbaru.
7. Pastikan dashboard konsisten dengan /reports dan /audit setelah laporan lokal dibuat.
8. Jangan ubah dummyReports.

Minor yang boleh dilakukan:
1. Hapus import tidak terpakai di ChecklistForm.tsx.
2. Perbaiki teks dashboard dari “Belum selesai atau ditolak” menjadi teks yang sesuai perhitungan.
3. Jika PlaceholderPage.tsx sudah tidak digunakan, boleh hapus hanya jika tidak merusak import.
4. Jangan ubah package.json hanya karena @emnapi/runtime extraneous.

Batasan:
1. Jangan menambah fitur baru.
2. Jangan integrasikan Supabase.
3. Jangan tambah API AI.
4. Jangan ubah rumus risk scoring.
5. Jangan ubah role access kecuali ada bug langsung terkait.
6. Jangan ubah QR, scan, form laporan, checklist, atau audit kecuali import/helper diperlukan.
7. Jangan hapus data localStorage pengguna.
8. Jangan ubah tampilan besar UI.

Validasi:
1. Buat laporan baru dari /reports/new?assetId=AST-001.
2. Pastikan laporan baru tampil di /reports.
3. Pastikan laporan baru ikut dihitung di /dashboard.
4. Pastikan laporan baru ikut dihitung di /audit.
5. Login sebagai teknisi.
6. Buka detail laporan.
7. Ubah status menjadi dalam penanganan.
8. Reload halaman detail laporan.
9. Pastikan dropdown status tetap menunjukkan dalam penanganan.
10. Simpan catatan tindak lanjut berikutnya.
11. Pastikan status tidak mundur ke diverifikasi.
12. npm run typecheck harus lulus.
13. npm run build harus lulus.
14. Tidak ada error runtime.
15. Tidak ada hydration error.

Setelah selesai:
1. Jelaskan file yang diubah.
2. Jelaskan perbaikan FollowUpPanel.
3. Jelaskan perbaikan Dashboard.
4. Jelaskan minor fix yang dilakukan.
5. Laporkan hasil npm run typecheck.
6. Laporkan hasil npm run build.
```

---

## 13. Definition of Done

Sebuah task dianggap selesai jika semua ini terpenuhi:

1. Scope task selesai.
2. Tidak ada fitur di luar task.
3. Role access tetap benar.
4. Desktop tidak overflow.
5. Mobile 390px tidak overflow.
6. Bottom navigation tidak menutup tombol utama.
7. Risk scoring tetap benar.
8. Data localStorage tetap konsisten.
9. Tidak ada hydration error.
10. `npm run typecheck` lulus.
11. `npm run build` lulus.
12. Agent melaporkan file yang diubah.
13. Agent melaporkan validasi yang dijalankan.
14. Agent jujur jika ada validasi yang belum dijalankan.

---

## 14. Command Validasi

Gunakan command sesuai yang tersedia di `package.json`.

Minimal:

```bash
npm run typecheck
npm run build
```

Jika tersedia:

```bash
npm run lint
npm run test
```

Untuk dev:

```bash
npm run dev
```

Untuk clean install bila dependency bermasalah:

```bash
rm -rf node_modules package-lock.json
npm install
npm run typecheck
npm run build
```

Di Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run typecheck
npm run build
```

Jangan menjalankan clean install jika user tidak meminta atau dependency tidak bermasalah serius.

---

## 15. Security Rules

### 15.1 Jangan commit secret

Jangan pernah menulis ini ke repository:

- API key
- token
- password
- connection string private
- Supabase service role key
- secret OpenAI key
- credential deployment

### 15.2 Environment variables

Jika nanti memakai env:

- gunakan `.env.local`,
- pastikan `.env.local` masuk `.gitignore`,
- buat `.env.example` tanpa secret,
- client-exposed env harus diawali `NEXT_PUBLIC_`,
- jangan masukkan secret ke `NEXT_PUBLIC_`.

### 15.3 Supabase nanti

Jika nanti user meminta Supabase:

- jangan aktifkan tanpa task khusus,
- gunakan official Supabase client,
- gunakan Row Level Security,
- jangan memakai service role key di client,
- buat migration/schema terpisah,
- buat test akses per role.

### 15.4 Prototype disclaimer

Karena sekarang masih dummy + localStorage:

- jangan klaim production-ready,
- jangan klaim data aman untuk produksi,
- jangan simpan data pribadi asli,
- gunakan data demo.

---

## 16. No-Hallucination Rules

Agent harus mengikuti aturan ini:

1. Jangan menyebut file ada jika belum diperiksa.
2. Jangan menyebut test lulus jika belum dijalankan.
3. Jangan menyebut deploy sukses jika belum dilakukan.
4. Jangan menulis “sudah aman produksi” karena prototype ini belum memakai auth/database production.
5. Jangan menyebut “AI” sebagai model machine learning jika fitur masih rule-based. Gunakan istilah “AI-Assisted / rule-based prototype”.
6. Jangan mengarang API endpoint.
7. Jangan mengarang skema Supabase.
8. Jangan mengubah persyaratan proposal tanpa izin user.

Jika tidak yakin, tulis:

```text
Saya belum bisa memastikan karena belum memeriksa [file/command]. Saya perlu mengecek itu terlebih dahulu.
```

---

## 17. UI/UX Rules

### 17.1 Mobile-first

Setiap halaman harus nyaman di layar 390px.

- Jangan tabel lebar di mobile.
- Gunakan card di mobile.
- Pastikan padding bawah cukup untuk bottom navigation.
- Tombol utama tidak boleh tertutup.
- Tidak boleh horizontal overflow.

### 17.2 Desktop

Desktop boleh memakai sidebar, grid, table, stat cards, summary sections.

### 17.3 Warna

Risiko:

| Risiko | Warna |
|---|---|
| rendah | hijau |
| sedang | kuning |
| tinggi | oranye |
| kritis | merah |

Asset:

| Status | Warna |
|---|---|
| layak | hijau |
| perlu dicek | kuning/oranye |
| tidak layak | merah |

Laporan:

| Status | Warna |
|---|---|
| baru | biru/slate |
| diverifikasi | teal |
| dalam penanganan | kuning/oranye |
| selesai | hijau |
| ditolak | merah/slate |

### 17.4 Bahasa

Gunakan Bahasa Indonesia. Hindari campur istilah asing kecuali istilah teknis umum seperti dashboard, export, QR Code.

---

## 18. Data Demo yang Harus Tetap Ada

Jangan hapus dummy data utama tanpa izin.

Expected minimum:

- 3 asset
- 4 laporan dummy
- risiko rendah, sedang, tinggi, kritis
- 3 checklist dummy
- SOP yang sesuai tiap asset penting
- placeholder report image tersedia
- contoh laporan kritis dengan skor 100

Jika perlu menambah data untuk testing, lakukan hati-hati dan jangan merusak angka demo utama kecuali task mengizinkan.

---

## 19. Regression Checklist

Setelah perubahan, minimal cek:

### 19.1 Route

- `/`
- `/login`
- `/dashboard`
- `/assets`
- `/assets/AST-001`
- `/scan`
- `/reports`
- `/reports/new?assetId=AST-001`
- `/reports/[id]`
- `/checklists`
- `/checklists/new?assetId=AST-001`
- `/audit`

### 19.2 Core flow

1. Login admin.
2. Buka dashboard.
3. Buka asset AST-001.
4. Pastikan QR tampil.
5. Login mahasiswa.
6. Buat laporan kritis 5×4×5.
7. Pastikan laporan tampil di `/reports`.
8. Pastikan dashboard menghitung laporan tersebut.
9. Login teknisi.
10. Ubah status laporan.
11. Reload detail laporan.
12. Pastikan status tidak mundur.
13. Login dosen.
14. Buat checklist dengan temuan risiko.
15. Login kepala lab.
16. Buka audit.
17. Export CSV.
18. Print.

### 19.3 Role access

- Mahasiswa tidak boleh `/checklists` dan `/audit`.
- Dosen tidak boleh `/audit`.
- Kepala lab tidak boleh `/scan`, `/reports/new`, `/checklists`.
- Teknisi dan admin boleh update status laporan.
- Role lain tidak boleh update status laporan.

---

## 20. Deployment Rules

Jangan deploy sebelum:

1. Task 11.1 lulus.
2. Final QA ulang lulus.
3. `npm run typecheck` lulus.
4. `npm run build` lulus.
5. README final tersedia.
6. Tidak ada secret.
7. Data demo konsisten.
8. Screenshot/mockup sudah bisa diambil.

Deploy target nanti:

- Vercel untuk Next.js
- Jangan tambahkan Supabase pada deployment MVP kecuali user meminta fase lanjutan.

---

## 21. README Final Harus Berisi

Jika user meminta README:

1. Nama project.
2. Deskripsi singkat.
3. Fitur MVP.
4. Tech stack.
5. Cara install.
6. Cara menjalankan lokal.
7. Role demo.
8. Skenario demo.
9. Batasan prototype.
10. Catatan bahwa data memakai dummy + localStorage.
11. Cara build.
12. Cara deploy.
13. Tidak ada Supabase/API AI pada MVP saat ini.

---

## 22. Screenshot untuk Proposal

Setelah QA bersih, ambil screenshot:

1. Login.
2. Dashboard Monitoring.
3. Data Asset.
4. Detail Asset + QR Code + SOP.
5. Scan QR Simulasi.
6. Form Laporan Bahaya + Risk Score.
7. Detail Laporan + Tindak Lanjut.
8. Checklist K3.
9. Audit Report.

Untuk proposal, minimal gabungkan 6 gambar:

- Login
- Dashboard Monitoring
- Detail Asset + QR Code
- SOP / Detail Asset
- Form Laporan Bahaya + Risk Score
- Audit Report

Caption:

```text
Gambar 2.3.5.1 Mockup VocaSafe Lab
```

---

## 23. Template Laporan Setelah Coding

Setelah agent mengubah kode, jawab dengan format ini:

```markdown
## Ringkasan Perubahan

[isi singkat]

## File Diubah

- `path/file.tsx` — alasan
- `path/file.ts` — alasan

## Validasi

- `npm run typecheck`: lulus/gagal/belum dijalankan
- `npm run build`: lulus/gagal/belum dijalankan
- runtime smoke test: lulus/gagal/belum dijalankan

## Risiko Tersisa

- [jika ada]

## Catatan

- [jika ada]
```

Jika ada command gagal, jangan sembunyikan. Tulis error ringkas dan file penyebab.

---

## 24. Template Review Tanpa Mengubah Kode

Jika user meminta review:

```markdown
## Hasil Review

Kode tidak diubah.

### Critical

- [jika ada]

### Major

- [jika ada]

### Minor

- [jika ada]

### Yang Lulus

- [daftar yang lulus]

### Rekomendasi

- [langkah berikutnya]
```

---

## 25. Larangan Refactor Besar

Jangan melakukan hal berikut kecuali diminta eksplisit:

- migrasi state management ke Redux/Zustand,
- mengubah semua komponen menjadi server/client secara massal,
- mengganti design system,
- mengganti route,
- mengganti struktur data besar,
- mengubah localStorage key,
- mengubah dummy data utama,
- menambah Supabase,
- menambah API AI,
- menambah kamera scanner,
- menambah library PDF,
- menambah chart library.

---

## 26. Jika Harus Bertanya

Tanyakan kepada user jika:

1. Ada instruksi bertentangan.
2. Ada file penting hilang.
3. Ada risiko data localStorage hilang.
4. Ada perubahan role access yang tidak jelas.
5. Ada kebutuhan install dependency baru.
6. Ada perubahan route.
7. Ada perubahan arsitektur.
8. Ada fitur baru yang tidak ada di scope.

Gunakan format:

```text
Saya perlu konfirmasi sebelum lanjut:
1. [pertanyaan]
2. [pertanyaan]
```

---

## 27. Prinsip Akhir

Project ini harus diperlakukan sebagai prototype hackathon yang stabil.

Prioritas:

1. Alur demo lancar.
2. Data konsisten.
3. Role access benar.
4. Risk scoring benar.
5. Mobile rapi.
6. Build lulus.
7. Tidak ada fitur liar.
8. Tidak ada klaim berlebihan.

Jangan mengejar “terlihat canggih” jika membuat demo tidak stabil.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
