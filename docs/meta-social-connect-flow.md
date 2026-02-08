# Resellio Social Connect Architect (Facebook Page + Instagram Business)

## 1) UI Flow (Next.js Dashboard)

1. User membuka halaman **Social Connect** dan melihat status awal: `Not connected`.
2. User klik tombol **Connect Facebook & Instagram**.
3. Client memanggil `GET /api/meta/connect` untuk mendapatkan URL OAuth lalu redirect ke Facebook Login.
4. Setelah user login + approve permission, Facebook redirect ke `GET /api/meta/callback`.
5. Server callback mengambil daftar Page yang user miliki (`id`, `name`, `page_access_token`, `instagram_business_account`).
6. Jika lebih dari 1 Page:
   - Server kirim daftar Page ke UI selector.
   - User memilih satu Page lalu submit ke endpoint finalize (mis. `POST /api/meta/select-page`).
7. Jika hanya 1 Page: server pilih default Page pertama dan lanjut otomatis.
8. Server validasi `instagram_business_account` ada. Jika valid, simpan koneksi ke DB.
9. UI refresh status menjadi `Connected` + tampilkan `page_name`, `facebook_page_id`, `ig_user_id`, `connected_at`.
10. Opsional: tombol **Disconnect** untuk revoke/putus koneksi (`POST /api/meta/disconnect`), lalu status kembali `Not connected`.

### Komponen UI minimal
- `Connect Facebook & Instagram` button.
- `ConnectionStatusCard`:
  - badge `Connected` / `Not connected`.
  - metadata koneksi (Page + IG).
- `PagePickerModal` (jika multi-page).
- `Disconnect` button (opsional, but recommended).

## 2) Server OAuth Flow (Vercel Functions)

### A. Start OAuth
**Endpoint:** `GET /api/meta/connect`

Alur:
1. Validasi session Resellio (`user_id_resellio` wajib ada).
2. Generate `state` (CSRF token), simpan di server (Redis/DB) dengan TTL 10 menit.
3. Build OAuth URL Meta (scopes contoh: `pages_show_list`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`).
4. Return URL OAuth ke client (atau langsung redirect 302).

### B. Callback OAuth
**Endpoint:** `GET /api/meta/callback?code=...&state=...`

Alur detail:
1. Validasi `state` terhadap data server (anti CSRF).
2. Tukar `code` -> **short-lived user access token**.
3. Tukar lagi ke **long-lived user token** (opsional tapi disarankan untuk stabilitas).
4. Panggil Graph API untuk ambil daftar Page user + `page_access_token`:
   - `/{user-id}/accounts?fields=id,name,access_token,instagram_business_account`
5. Pilih Page:
   - jika satu Page => auto-select
   - jika banyak => kirim daftar ke UI, user pilih satu
6. Ambil `instagram_business_account.id` dari Page terpilih (`ig_user_id`).
7. Simpan ke DB:
   - `user_id_resellio`
   - `facebook_page_id`
   - `instagram_business_account_id` (`ig_user_id`)
   - `page_access_token`
   - `expires_at`
   - `scopes_granted` (opsional, sangat disarankan)
8. Return sukses ke client, UI menampilkan `Connected`.

### C. Setelah connect: scheduling
Setelah koneksi valid, job scheduler Resellio dapat menulis job ke `POST /api/meta/schedule` dengan referensi `connection_id`/`user_id_resellio`.
Worker/job runner memakai token yang tersimpan di server untuk post ke Graph API (bukan token dari client).

## 3) Data minimal untuk bisa posting

Sesuai kebutuhan minimal:
- `facebook_page_id`
- `instagram_business_account_id` (`ig_user_id`)
- `page_access_token` **atau** mekanisme refresh token + re-issue token terjadwal

Tambahan recommended untuk reliability:
- `user_id_resellio`
- `expires_at`
- `token_last_checked_at`
- `scopes_granted`
- `page_name` (cache display UI)

## 4) Error states + UI message

| error_code | Kondisi teknis | Pesan UI yang ditampilkan | Aksi pengguna |
|---|---|---|---|
| `not_admin_page` | User login FB tapi bukan admin/editor Page target | "Akun Facebook ini tidak punya akses admin/editor ke Page yang dipilih." | Ganti akun Facebook atau minta akses Page |
| `instagram_not_connected_to_page` | Page tidak memiliki `instagram_business_account` | "Page Facebook belum terhubung ke Instagram Business." | Hubungkan IG Business ke Page di Meta Business Suite |
| `token_expired` | `page_access_token` kadaluarsa / invalid saat posting | "Koneksi Meta kedaluwarsa. Silakan connect ulang." | Klik reconnect (flow OAuth ulang) |
| `permissions_missing` | Scope tidak lengkap atau ditolak user | "Izin Meta belum lengkap untuk auto-posting." | Ulangi connect dan setujui semua izin yang diminta |

## 5) Checklist implementasi (maks 12)

- [ ] Tambah tabel `social_connections` (user_id_resellio, page_id, ig_user_id, token, expires_at).
- [ ] Implement `GET /api/meta/connect` (generate state + OAuth URL).
- [ ] Implement `GET /api/meta/callback` (validate state + exchange token).
- [ ] Implement fetch Page list + `instagram_business_account` dari Graph API.
- [ ] Tambah endpoint `POST /api/meta/select-page` (jika multi-page flow).
- [ ] Simpan token terenkripsi di DB (at-rest encryption / KMS).
- [ ] Buat `GET /api/meta/status` untuk status Connected/Not connected.
- [ ] Buat `POST /api/meta/disconnect` untuk revoke/soft-delete koneksi.
- [ ] Integrasikan UI button Connect + status card + page picker modal.
- [ ] Mapping error Graph API -> `not_admin_page`, `permissions_missing`, dst.
- [ ] Validasi token sebelum enqueue `POST /api/meta/schedule`.
- [ ] Tambah observability: audit log connect/disconnect + error metrics.

## 6) Endpoint contract (input/output JSON singkat)

### `GET /api/meta/connect`
**Response 200**
```json
{
  "oauth_url": "https://www.facebook.com/v20.0/dialog/oauth?...",
  "state": "opaque_state_id"
}
```

### `GET /api/meta/callback`
Query: `code`, `state`

**Response 200 (single page auto-selected)**
```json
{
  "connected": true,
  "facebook_page_id": "123456789",
  "instagram_business_account_id": "1784xxxx",
  "status": "connected"
}
```

**Response 200 (multiple page, need choose)**
```json
{
  "connected": false,
  "requires_page_selection": true,
  "pages": [
    { "id": "123", "name": "Page A", "has_instagram": true },
    { "id": "456", "name": "Page B", "has_instagram": false }
  ]
}
```

### `POST /api/meta/select-page`
**Request**
```json
{
  "page_id": "123456789"
}
```

**Response 200**
```json
{
  "connected": true,
  "facebook_page_id": "123456789",
  "instagram_business_account_id": "1784xxxx"
}
```

### `GET /api/meta/status`
**Response 200**
```json
{
  "status": "connected",
  "facebook_page_id": "123456789",
  "instagram_business_account_id": "1784xxxx",
  "page_name": "Resellio Official"
}
```

### `POST /api/meta/disconnect`
**Response 200**
```json
{
  "disconnected": true,
  "status": "not_connected"
}
```

### `POST /api/meta/schedule`
**Request**
```json
{
  "connection_id": "conn_abc123",
  "publish_at": "2026-02-20T10:00:00Z",
  "caption": "Promo minggu ini",
  "media_url": "https://..."
}
```

**Response 200**
```json
{
  "queued": true,
  "job_id": "job_987"
}
```

## 7) Catatan keamanan (yang tidak boleh disimpan di client)

Jangan simpan di browser/localStorage/sessionStorage:
- `page_access_token`
- user access token Meta (short-lived/long-lived)
- `app_secret`
- raw OAuth `code`
- credential DB/KMS

Praktik aman:
- Simpan token hanya di server DB terenkripsi.
- Gunakan HttpOnly secure cookie untuk session aplikasi.
- Validasi `state` dan batasi TTL.
- Minimalisasi log (mask token, jangan log penuh).
- Terapkan rotate + reauth ketika token invalid/expired.
