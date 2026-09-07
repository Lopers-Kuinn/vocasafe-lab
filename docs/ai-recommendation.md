# AI-Assisted Risk Recommendation

Fitur ini membantu pengguna meninjau laporan bahaya. AI tidak menentukan keputusan risiko final dan tidak mengubah laporan yang sudah tersimpan.

## Alur

1. Pengguna mengisi aset, lokasi, judul, deskripsi, serta penilaian awal.
2. Server memverifikasi session, profil aktif, role, rate limit, dan request body.
3. Provider mengembalikan saran terstruktur.
4. Server memvalidasi seluruh field dan menghitung ulang skor serta kategori.
5. Pengguna memilih menggunakan, mengubah, atau mengabaikan saran.
6. Submit memakai nilai akhir yang terlihat pada form.

Jika konteks laporan berubah, saran lama dibatalkan agar tidak diterapkan pada kondisi yang berbeda.

## Output yang diizinkan

- kategori bahaya;
- suggested severity, probability, dan exposure 1–5;
- alasan maksimal dua kalimat;
- rekomendasi maksimal lima kalimat;
- provider yang digunakan.

`suggestedRiskScore` dan `suggestedRiskCategory` selalu dihitung server-side. Reasoning, chain of thought, raw provider response, token, cookie, dan error internal tidak dikirim ke client.

## Provider dan fallback

Provider yang didukung: Gemini, OpenRouter, OpenAI, dan DeepSeek. Provider bersifat opsional. Jika key tidak tersedia, request timeout, atau output invalid, sistem memakai rekomendasi rule-based.

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
```

Semua API key bersifat server-only dan tidak boleh memakai prefix `NEXT_PUBLIC_`.

## Proteksi endpoint

- session Supabase wajib valid;
- profil harus tersedia dan aktif;
- role harus memiliki akses membuat laporan;
- limit 10 request per pengguna dalam 60 detik;
- response memakai `Cache-Control: no-store`;
- request provider memiliki timeout;
- input yang tidak konsisten ditolak sebelum provider dipanggil.

## Prinsip keselamatan

Rekomendasi AI merupakan dukungan keputusan. Tindakan akhir tetap mengikuti SOP, inspeksi fisik, petugas berwenang, dan ketentuan K3 institusi.
