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

7. **Meta Social Connection Status + OAuth Connect**
   - Tombol **Connect Facebook & Instagram** di dashboard memulai OAuth ke Meta.
   - Callback OAuth menyimpan koneksi Page + Instagram Business (cookie HttpOnly server-side).
   - Route serverless: `app/api/meta/connect`, `app/api/meta/callback`, `app/api/meta/status`, dan `app/api/meta/disconnect`.
   - Status menampilkan `page_name`, `page_id`, `ig_user_id`, `scopes_ok`, dan `token_expired`.

## Environment Variables (Meta OAuth)

Tambahkan variabel berikut di `.env.local` saat ingin koneksi akun Meta:

```bash
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
# opsional, default: http://localhost:3000/api/meta/callback
META_REDIRECT_URI=http://localhost:3000/api/meta/callback
```

Pastikan URI callback di atas juga terdaftar di pengaturan aplikasi Meta Developers.

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
