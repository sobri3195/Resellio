# Resellio (Next.js App Router)

Dashboard tool importir/reseller UMKM tanpa backend tradisional, siap deploy ke **Vercel**.

## Fitur Utama

1. **Product Link Grabber**
   - Paste link Shopee / Tokopedia / Alibaba / 1688 / AliExpress.
   - Route serverless `app/api/grab` mengambil metadata (`title`, `image`, `price`) dari Open Graph / Twitter Card / LD+JSON.
   - Validasi domain marketplace + fallback aman saat metadata gagal.

2. **Smart Pricing Engine**
   - Hitung harga jual otomatis dari: base cost + markup + shipping + biaya platform + biaya iklan.
   - Menampilkan estimasi profit untuk bantu keputusan pricing reseller.

3. **AI Caption Generator**
   - Generate caption Instagram dengan tone (`friendly`, `urgent`, `premium`).
   - Auto CTA, emoji, hashtag niche, dan hashtag tambahan custom.
   - Tombol copy caption ke clipboard.

4. **Instagram Auto Posting & Scheduling**
   - Simpan jadwal posting (tanggal/jam/channel).
   - Opsional kirim payload ke webhook/Meta relay endpoint (mis. Vercel Function, n8n, Make, Zapier).


5. **Relay Response Formatter**
   - Route serverless `app/api/relay/format` untuk menormalkan hasil job `instagram/facebook_page`.
   - Output selalu konsisten:
     - `ok=true` jika minimal satu job `scheduled/published`.
     - `results[]` berisi `channel`, `job_id`, `status`, dan `message`.
   - Error message dipadatkan (contoh: `account_not_connected`, `token_expired`, `no_media`).

6. **Content Calendar visual (localStorage)**
   - Menampilkan daftar jadwal posting secara visual.
   - Filter channel, update status (`draft/scheduled/posted`), dan hapus item.
   - Data tersimpan di browser (`localStorage`) tanpa database eksternal.

## Jalankan Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Deploy ke Vercel

1. Push repository ke Git provider.
2. Import project di Vercel.
3. Gunakan setting default Next.js.
4. Deploy.

Tidak memerlukan backend tradisional/database. Integrasi posting otomatis dapat memakai webhook eksternal.
