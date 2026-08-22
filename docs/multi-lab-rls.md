# Multi-Laboratory RLS Hardening

## Tujuan dan Threat Model

Migration `005_multi_lab_rls_hardening.sql` membatasi data operasional berdasarkan `user_profiles.laboratory_id`. Ancaman utamanya adalah user authenticated dengan role operasional yang memanggil Supabase REST atau Storage secara langsung untuk membaca atau mengubah data laboratorium lain. Filter UI tidak dianggap sebagai kontrol keamanan; enforcement dilakukan oleh Row Level Security.

Aturan akhir:

- Admin aktif memiliki akses global untuk target laboratorium non-null.
- Teknisi dan kepala laboratorium aktif dapat membaca data manajerial hanya untuk laboratoriumnya sendiri.
- Setelah migration 007, perubahan status laporan dan tindak lanjut hanya dapat dilakukan oleh teknisi pada laboratoriumnya sendiri atau admin global; kepala laboratorium tetap view-only.
- Non-admin tanpa `laboratory_id` gagal tertutup untuk akses berbasis laboratorium.
- Reporter aktif tetap dapat membaca report miliknya sendiri.
- Inspector aktif tetap dapat membaca checklist result miliknya sendiri.
- Template checklist dengan `laboratory_id IS NULL` merupakan template global bagi role checklist yang sudah diizinkan.
- Tidak ada akses anonymous, service role, atau filter client-side sebagai enforcement.

## Helper Authorization

Seluruh helper menggunakan `SECURITY DEFINER`, `SET search_path = ''`, object schema-qualified, identity dari `auth.uid()`, dan profil aktif dari `public.user_profiles`.

| Helper | Fungsi |
|---|---|
| `get_current_user_role()` | Mengembalikan role profil aktif atau `NULL` dengan `search_path` yang diperkeras |
| `current_user_laboratory_id()` | Mengembalikan lab profil aktif atau `NULL` |
| `can_access_laboratory(uuid)` | Admin global; non-admin hanya lab sendiri |
| `can_manage_laboratory(uuid)` | Admin global; teknisi/kepala lab hanya lab sendiri |
| `can_create_in_laboratory(uuid)` | Memvalidasi target lab record yang dibuat client |
| `can_read_report(uuid)` | Reporter sendiri atau manager lab report |
| `can_manage_report(uuid)` | Setelah migration 007: teknisi pada lab report atau admin global; reporter dan kepala laboratorium tidak otomatis dapat mengubah report |
| `can_read_checklist_result(uuid)` | Inspector sendiri atau manager lab result |

Execute helper dicabut dari `public` dan `anon`, lalu diberikan hanya kepada `authenticated`. Helper legacy `is_report_manager()` dihapus tanpa penghapusan dependency otomatis setelah seluruh tracked policy yang menggunakannya diganti.

## Policy yang Diganti

Migration mengganti policy SELECT master data untuk laboratories, assets, SOP, fasilitas K3, dan risk points; policy report SELECT/INSERT/UPDATE; follow-up; attachment metadata; Storage evidence; template/item checklist; checklist result; serta checklist result item.

Tidak ada policy DELETE baru. Admin write policy, user profile policy, audit log policy, formula risk scoring, dan rate limiter migration 004 tidak diubah.

### Intentional narrowing untuk checklist result items

Policy INSERT `checklist_result_items` sengaja tidak lagi memberikan kemampuan insert berdasarkan status manager. Manager hanya dapat membaca checklist result yang diizinkan oleh scope laboratory dan tidak boleh menyisipkan atau memodifikasi jawaban pada checklist milik inspector lain.

Jawaban checklist hanya dapat dibuat oleh inspector aktif yang menjadi pemilik parent result dan memiliki role `dosen`, `teknisi`, atau `admin`. `kepala_lab` tidak dapat insert checklist result item. Admin juga hanya dapat insert item ketika admin tersebut adalah inspector parent result; status admin global tidak mengubah ownership jawaban checklist.

## Regression fix untuk INSERT RETURNING

Migration 005 semula menggunakan lookup helper `STABLE` kembali ke parent table pada policy SELECT `reports` dan `checklist_results`. Aplikasi Supabase membuat kedua parent record melalui pola `INSERT ... RETURNING`, yaitu `.insert(...).select().single()`, sehingga row baru juga harus langsung lolos policy SELECT.

Migration `006_self_row_returning_rls_fix.sql` hanya mengganti dua parent-table SELECT policy tersebut dengan pemeriksaan row-local terhadap `reporter_id` atau `inspector_id`, disertai profil aktif, serta authorization manager berdasarkan `laboratory_id` row. Semantics multi-lab tidak berubah. Helper `can_read_report()` dan `can_read_checklist_result()` tetap digunakan untuk authorization resource child seperti follow-up, attachment metadata, Storage evidence, dan checklist result items.

## Workflow atomik dan role mutation laporan

Migration `007_atomic_workflows_and_report_roles.sql` menambahkan RPC atomik untuk menyimpan status beserta follow-up laporan dan untuk menyimpan parent checklist beserta seluruh jawabannya. Migration ini juga menyelaraskan `can_manage_report()` dengan aturan aplikasi: hanya teknisi pada laboratorium report dan admin global yang boleh mengubah status atau menambah follow-up. Kepala laboratorium tetap dapat membaca report pada laboratoriumnya melalui authorization read, tetapi tidak mendapatkan kontrol mutation.

## SQL Preflight Read-Only

Jalankan query berikut secara manual sebelum migration 005 melalui Supabase SQL Editor atau database-owner/admin context yang dapat melihat seluruh row. Jangan menjalankannya melalui session aplikasi biasa karena RLS dapat menyembunyikan data bermasalah. Semua query hanya membaca data; jangan melakukan remediation otomatis sebelum hasilnya direview.

### 1. Profil non-admin aktif tanpa laboratory

```sql
select id, email, role, laboratory_id
from public.user_profiles
where is_active = true
  and role <> 'admin'
  and laboratory_id is null;
```

### 2. Report tanpa laboratory

```sql
select id, report_number, reporter_id, asset_id, laboratory_id
from public.reports
where laboratory_id is null;
```

### 3. Report dan asset berbeda laboratory

```sql
select report.id, report.report_number,
       report.laboratory_id as report_laboratory_id,
       asset.laboratory_id as asset_laboratory_id
from public.reports as report
join public.assets as asset on asset.id = report.asset_id
where report.laboratory_id is distinct from asset.laboratory_id;
```

### 4. Checklist result tanpa laboratory

```sql
select id, template_id, asset_id, inspector_id, laboratory_id
from public.checklist_results
where laboratory_id is null;
```

### 5. Checklist result dan asset berbeda laboratory

```sql
select result.id,
       result.laboratory_id as result_laboratory_id,
       asset.laboratory_id as asset_laboratory_id
from public.checklist_results as result
join public.assets as asset on asset.id = result.asset_id
where result.laboratory_id is distinct from asset.laboratory_id;
```

### 6. Checklist result dan template lab-spesifik berbeda laboratory

```sql
select result.id,
       result.laboratory_id as result_laboratory_id,
       template.laboratory_id as template_laboratory_id
from public.checklist_results as result
join public.checklist_templates as template on template.id = result.template_id
where template.laboratory_id is not null
  and result.laboratory_id is distinct from template.laboratory_id;
```

### 7. Attachment metadata tanpa report parent

```sql
select attachment.id, attachment.report_id, attachment.path
from public.report_attachments as attachment
left join public.reports as report on report.id = attachment.report_id
where report.id is null;
```

### 8. Follow-up tanpa report parent

```sql
select followup.id, followup.report_id, followup.created_by
from public.report_followups as followup
left join public.reports as report on report.id = followup.report_id
where report.id is null;
```

### 9. Checklist result item mismatch

```sql
select result_item.id, result_item.result_id, result_item.item_id,
       result.template_id as result_template_id,
       item.template_id as item_template_id
from public.checklist_result_items as result_item
left join public.checklist_results as result on result.id = result_item.result_id
left join public.checklist_items as item on item.id = result_item.item_id
where result.id is null
   or item.id is null
   or result.template_id is distinct from item.template_id;
```

### 10. Data lab-scoped legacy yang akan fail closed

```sql
select 'assets' as entity, count(*) as rows_without_laboratory
from public.assets where laboratory_id is null
union all
select 'sops', count(*) from public.sops where laboratory_id is null
union all
select 'k3_facilities', count(*) from public.k3_facilities where laboratory_id is null
union all
select 'risk_points', count(*) from public.risk_points where laboratory_id is null;
```

## Runtime Test Matrix

Siapkan dua laboratorium, `LAB-A` dan `LAB-B`, dengan akun `admin-global`, `teknisi-a`, `teknisi-b`, `kepala-lab-a`, `kepala-lab-b`, `dosen-a`, dan `mahasiswa-a`. Siapkan `report-a`, `report-b`, `checklist-a`, `checklist-b`, `evidence-a`, dan `evidence-b` pada lab masing-masing.

| Operasi | Admin | Teknisi A | Teknisi B | Kepala A | Kepala B | Dosen A | Mahasiswa A |
|---|---|---|---|---|---|---|---|
| Read report A | Global | Ya | Tidak | Ya | Tidak | Own only | Own only |
| Read report B | Global | Tidak | Ya | Tidak | Ya | Own only | Own only |
| Manage report A/B | Global | A saja | B saja | Tidak | Tidak | Tidak | Tidak |
| Insert follow-up A/B | Global | A saja | B saja | Tidak | Tidak | Tidak | Tidak |
| Read attachment/Storage | Global | A saja | B saja | A saja | B saja | Own report | Own report |
| Read checklist A/B | Global | A saja | B saja | A saja | B saja | Own result | Tidak |
| Dashboard/audit summary | Global | A saja | B saja | A saja | B saja | Sesuai route existing | Sesuai route existing |

Negative test wajib:

1. Cross-lab report SELECT dan UPDATE.
2. Cross-lab follow-up INSERT.
3. Cross-lab attachment metadata dan Storage SELECT.
4. Cross-lab checklist result dan result item SELECT.
5. Spoof `reports.laboratory_id` dan `checklist_results.laboratory_id`.
6. Mismatch asset laboratory.
7. Mismatch template laboratory non-global.
8. Profil inactive atau non-admin tanpa laboratory.

Operasi terlarang harus menghasilkan zero rows atau RLS permission denial, bukan data yang diterima lalu disembunyikan UI. Uji juga reporter-own, inspector-own, template global, upload evidence same-lab, signed URL, create report/checklist, dashboard, audit, Gemini, dan AI rate limiter sebagai regresi.

## Phase 3E: Validasi Cross-Laboratory Reversible

Jalankan `docs/sql/phase3-cross-lab-rls-validation.sql` secara utuh melalui Supabase SQL Editor dalam database-owner/admin execution context. Script memilih profil aktif LAB-A tanpa hardcode email, dengan prioritas `teknisi` lalu `kepala_lab`, dan berhenti tanpa melanjutkan test bila kandidat tidak tersedia. Identitas aplikasi disimulasikan secara transaction-local melalui role `authenticated` dan JWT claims lokal; assertion awal memastikan `auth.uid()` sama dengan profil yang dipilih sehingga test gagal tertutup bila simulasi tidak reliabel.

Script membuat LAB-B sementara beserta asset, report, follow-up, metadata attachment, template checklist, checklist item, checklist result, dan result item menggunakan identifier deterministik yang terlebih dahulu diperiksa agar tidak bertabrakan. Negative assertions memastikan manager LAB-A tidak dapat melihat LAB-B atau resource LAB-B, tidak dapat mengubah report LAB-B, dan tidak dapat menambahkan follow-up ke report LAB-B. Positive assertions memastikan manager tetap dapat melihat LAB-A serta seluruh asset/report LAB-A yang memang tersedia; bagian tanpa data dicatat sebagai `SKIP`, bukan diklaim lulus tanpa bukti.

Jika profil admin aktif tersedia, script mensimulasikan admin secara terpisah dan memastikan akses global ke LAB-A serta fixture LAB-B. Jika tidak ada admin, assertion tersebut dicatat sebagai `SKIP`. Own-access reporter/inspector LAB-B tidak diuji dengan memindahkan profil produksi atau membuat user baru; ketika tidak ada user LAB-B existing, perilaku tersebut tetap memerlukan normal single-lab regression terpisah.

SQL hanya menguji authorization metadata `report_attachments`. Script tidak membuat row internal Storage atau object fisik, sehingga upload, signed URL, dan penolakan object lintas lab harus diuji melalui browser/API dengan session authenticated dan object Storage aktual.

Kriteria `PASS` adalah seluruh cross-lab SELECT menghasilkan zero rows, UPDATE report lintas lab menghasilkan zero affected rows atau penolakan RLS, INSERT follow-up lintas lab ditolak, same-lab visibility tetap utuh, dan admin global dapat melihat kedua lab jika admin tersedia. Script dimulai dengan `BEGIN`, tidak mengubah profil user atau data produksi existing, dan selalu ditutup dengan `ROLLBACK`; LAB-B beserta seluruh fixture tidak menjadi data permanen. Query verifikasi cleanup read-only disediakan sebagai komentar di akhir script untuk dijalankan sesudah rollback bila diperlukan.

## Rollback Strategy

Jangan mengedit migration 005 setelah diterapkan ke production. Jika rollback diperlukan, buat migration baru bernomor berikutnya yang secara eksplisit mengganti helper dan policy terkait. Jangan menghapus dependency secara otomatis, menonaktifkan RLS, atau mengembalikan helper manager global tanpa target laboratory.
