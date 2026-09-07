-- VocaSafe Lab D4 initial seed data
-- Admin Auth user and user_profiles are intentionally not seeded here.
-- Create the first admin manually in Supabase Dashboard, then insert/sync user_profiles.

insert into public.laboratories (id, code, name, department, location)
values (
  '11111111-1111-1111-1111-111111111111',
  'LAB-VOKASI-01',
  'Laboratorium Vokasi Utama',
  'Pendidikan Vokasi',
  'Gedung Praktikum'
)
on conflict (code) do nothing;

insert into public.sops (id, laboratory_id, title, version, last_updated_at, required_ppe, steps)
values
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111111',
    'SOP Penggunaan Mesin Bor',
    '1.0',
    now(),
    array['Kacamata keselamatan', 'Sepatu keselamatan', 'Sarung tangan kerja'],
    '["Periksa kabel, pelindung, dan tombol darurat sebelum digunakan.", "Pastikan benda kerja terkunci kuat pada ragum.", "Gunakan mata bor sesuai material.", "Matikan mesin dan bersihkan area kerja setelah digunakan."]'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111111',
    'SOP Pemeriksaan APAR',
    '1.0',
    now(),
    array['Sarung tangan kerja'],
    '["Pastikan APAR mudah dijangkau.", "Periksa segel dan pin pengaman.", "Pastikan indikator tekanan berada pada zona aman.", "Catat tanggal pemeriksaan pada kartu inspeksi."]'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111111',
    'SOP Pemeriksaan P3K',
    '1.0',
    now(),
    array['Sarung tangan bersih'],
    '["Pastikan kotak P3K mudah dijangkau.", "Periksa kelengkapan perban, antiseptik, dan plester.", "Pastikan tidak ada item kedaluwarsa.", "Laporkan kekurangan perlengkapan ke teknisi atau admin."]'::jsonb
  )
on conflict (id) do nothing;

insert into public.assets (id, laboratory_id, sop_id, code, name, kind, category, location, description, status, qr_payload, last_inspection_at, next_inspection_at)
values
  (
    '33333333-3333-3333-3333-333333333301',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'AST-001',
    'Mesin Bor Duduk 01',
    'alat',
    'Mesin perkakas',
    'Lab Teknik Mesin',
    'Mesin bor duduk untuk praktik pemesinan dasar.',
    'tidak_layak',
    'vocasafe://assets/AST-001',
    now() - interval '7 days',
    now() + interval '23 days'
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    'AST-002',
    'APAR Ruang Praktikum',
    'fasilitas',
    'Proteksi kebakaran',
    'Lab Pengelasan',
    'APAR dry chemical powder berkapasitas 6 kg.',
    'perlu_dicek',
    'vocasafe://assets/AST-002',
    now() - interval '30 days',
    now() + interval '1 day'
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222203',
    'AST-003',
    'Kotak P3K',
    'fasilitas',
    'Pertolongan pertama',
    'Koridor Lab Utama',
    'Kotak P3K untuk pertolongan pertama di area praktik.',
    'layak',
    'vocasafe://assets/AST-003',
    now() - interval '14 days',
    now() + interval '16 days'
  )
on conflict (code) do nothing;

insert into public.k3_facilities (id, laboratory_id, asset_id, name, facility_type, location, status, last_checked_at, next_check_at, notes)
values
  (
    '44444444-4444-4444-4444-444444444401',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333302',
    'APAR Ruang Praktikum',
    'APAR',
    'Lab Pengelasan',
    'perlu_dicek',
    now() - interval '30 days',
    now() + interval '1 day',
    'Perlu pemeriksaan tekanan dan segel.'
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333303',
    'Kotak P3K',
    'P3K',
    'Koridor Lab Utama',
    'layak',
    now() - interval '14 days',
    now() + interval '16 days',
    'Perlengkapan dasar tersedia.'
  )
on conflict (id) do nothing;

insert into public.checklist_templates (id, laboratory_id, title, asset_kind, is_active)
values (
  '55555555-5555-5555-5555-555555555501',
  '11111111-1111-1111-1111-111111111111',
  'Checklist K3 Laboratorium Vokasi',
  null,
  true
)
on conflict (id) do nothing;

insert into public.checklist_items (id, template_id, label, is_critical, guidance, sort_order)
values
  ('66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555501', 'Kondisi fisik alat/fasilitas', true, 'Periksa kerusakan, retak, aus, atau bagian longgar.', 1),
  ('66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555501', 'Kabel dan konektor', true, 'Pastikan kabel tidak terkelupas dan konektor tidak longgar.', 2),
  ('66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555501', 'Panel listrik', true, 'Pastikan panel tertutup, berlabel, dan tidak lembap.', 3),
  ('66666666-6666-6666-6666-666666666604', '55555555-5555-5555-5555-555555555501', 'APD tersedia', true, 'Pastikan APD sesuai aktivitas tersedia dan layak pakai.', 4),
  ('66666666-6666-6666-6666-666666666605', '55555555-5555-5555-5555-555555555501', 'APAR tersedia dan layak', true, 'Periksa posisi, tekanan, pin, dan masa berlaku APAR.', 5),
  ('66666666-6666-6666-6666-666666666606', '55555555-5555-5555-5555-555555555501', 'Kotak P3K lengkap', true, 'Pastikan isi P3K lengkap dan tidak kedaluwarsa.', 6),
  ('66666666-6666-6666-6666-666666666607', '55555555-5555-5555-5555-555555555501', 'Kebersihan area kerja', false, 'Area kerja bersih, kering, dan bebas material berbahaya.', 7),
  ('66666666-6666-6666-6666-666666666608', '55555555-5555-5555-5555-555555555501', 'Safety sign tersedia', false, 'Rambu keselamatan terlihat jelas dan mudah dibaca.', 8),
  ('66666666-6666-6666-6666-666666666609', '55555555-5555-5555-5555-555555555501', 'Jalur evakuasi tidak terhalang', true, 'Pastikan jalur evakuasi bebas hambatan.', 9),
  ('66666666-6666-6666-6666-666666666610', '55555555-5555-5555-5555-555555555501', 'Ventilasi ruangan baik', false, 'Pastikan sirkulasi udara berjalan baik.', 10)
on conflict (id) do nothing;
