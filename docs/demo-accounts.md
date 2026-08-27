# Akun Demo Berbasis Role

VocaSafe Lab menyediakan pemilih role satu klik pada halaman `/login` untuk
lingkungan development dan deployment demo yang dikonfigurasi secara eksplisit.
Login tetap menggunakan Supabase Auth serta `public.user_profiles`; fitur ini
tidak meniru role di browser dan tidak melewati RLS.

## Akun yang Diperlukan

| Email | Role profil | Scope laboratorium |
|---|---|---|
| `demo.mahasiswa@vocasafe.id` | `mahasiswa` | Laboratorium demo |
| `demo.dosen@vocasafe.id` | `dosen` | Laboratorium demo |
| `demo.teknisi@vocasafe.id` | `teknisi` | Laboratorium demo |
| `demo.kepala-lab@vocasafe.id` | `kepala_lab` | Laboratorium demo |
| `demo.admin@vocasafe.id` | `admin` | Global (`laboratory_id` null) |

Kelima user harus dibuat melalui Supabase Authentication dengan email yang
sudah dikonfirmasi dan password yang sama dengan `DEMO_ACCOUNT_PASSWORD`.
Setiap UUID Auth kemudian harus memiliki row `public.user_profiles` yang aktif,
memakai email dan role persis seperti tabel di atas. Gunakan UUID laboratorium
demo yang benar untuk empat role non-admin.

Jangan menaruh password akun demo dalam migration, seed, dokumentasi, source
code, atau variabel `NEXT_PUBLIC_*`.

## Environment

Development membutuhkan password server-only di `.env.local`:

```text
DEMO_ACCOUNT_PASSWORD=
```

Pada production, mode demo tidak aktif secara default. Deployment demo harus
mengatur ketiga variabel berikut:

```text
NEXT_PUBLIC_DEMO_MODE_ENABLED=true
DEMO_MODE_ENABLED=true
DEMO_ACCOUNT_PASSWORD=
```

- `NEXT_PUBLIC_DEMO_MODE_ENABLED` hanya mengatur visibilitas pemilih role.
- `DEMO_MODE_ENABLED` mengaktifkan endpoint login demo di server.
- `DEMO_ACCOUNT_PASSWORD` bersifat server-only dan tidak pernah dikirim ke
  browser.

## Batas Keamanan

Akun demo menggunakan hak akses nyata sesuai RLS. Tombol Admin memberi akses
admin nyata pada database yang digunakan deployment tersebut. Karena itu:

1. Aktifkan mode demo hanya pada project Supabase khusus demo.
2. Jangan aktifkan akun admin demo pada database operasional atau database yang
   berisi data pribadi/rahasia.
3. Gunakan data sintetis dan reset data demo secara berkala.
4. Nonaktifkan kedua flag mode demo setelah sesi demo publik selesai.
5. Rotasi `DEMO_ACCOUNT_PASSWORD` jika pernah dibagikan atau diduga bocor.

## Verifikasi

1. Buka `/login` dan pastikan lima tombol role tampil.
2. Masuk dengan setiap role dan pastikan diarahkan ke `/dashboard`.
3. Pastikan menu dan pembatasan route mengikuti role masing-masing.
4. Pastikan role tidak valid ditolak dan request lintas origin tidak diterima.
5. Pastikan `.env.local` tidak muncul pada `git status` atau `git ls-files`.
