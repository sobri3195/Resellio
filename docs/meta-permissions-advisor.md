# Resellio Meta Permissions Advisor

## Daftar permission/scope per fitur

- **Ambil daftar Facebook Page yang user kelola**:
  - `pages_show_list` (wajib untuk membaca daftar Page yang user bisa akses).

- **Posting & scheduling ke Facebook Page**:
  - `pages_manage_posts` (wajib untuk membuat/mengelola post di Page).
  - `pages_read_engagement` (opsional tapi umum dipakai untuk membaca status/performa post setelah publish/schedule).

- **Posting ke Instagram Business yang terhubung ke Page**:
  - `instagram_basic` (wajib untuk membaca identitas akun IG Business).
  - `instagram_content_publish` (wajib untuk publish konten ke IG Business).
  - `pages_show_list` (tetap diperlukan untuk memilih Page yang terhubung).

- **Membaca status koneksi (`page_id`, `ig_user_id`)**:
  - `pages_show_list` (untuk membaca `page_id` dan relasi Page).
  - `instagram_basic` (untuk membaca `ig_user_id` dari akun IG Business yang terhubung).

## Kapan perlu App Review

- **Perlu App Review** saat aplikasi dipakai oleh user di luar role aplikasi (Admin/Developer/Tester) dan meminta permission di atas pada mode **Live**.
- **Belum perlu App Review** jika masih tahap development internal dan hanya dipakai akun yang masuk role aplikasi.
- Jika hanya login dasar tanpa permission lanjutan Meta, biasanya review tidak diperlukan; namun fitur Resellio di atas termasuk permission lanjutan sehingga **praktis perlu App Review** sebelum go-live.
