

## Analisis Bug HalalTrack

### Bug yang Ditemukan

#### BUG 1 (KRITIS): Semua Database Trigger Tidak Terpasang
Fungsi-fungsi trigger sudah dibuat tapi **tidak ada satupun trigger yang terpasang** ke tabel manapun:
- `handle_new_user` -- tidak terpasang ke `auth.users` sehingga tabel `profiles` kosong (0 baris)
- `generate_tracking_code` -- tidak terpasang ke `data_entries`
- `auto_update_entry_status` -- tidak terpasang ke `data_entries`
- `log_status_change` -- tidak terpasang ke `data_entries`
- `update_updated_at_column` -- tidak terpasang ke tabel manapun

**Dampak:**
- Tabel `profiles` kosong -- halaman Kelola User tidak menampilkan user apapun
- Tambah anggota group gagal karena daftar user kosong (diambil dari profiles)
- Tracking code tidak di-generate otomatis
- Status tidak berubah otomatis saat NIB/sertifikat diupload
- Audit log tidak tercatat

#### BUG 2: Edge Function `create-user` dan `delete-user` -- Method Auth Salah
Kedua fungsi menggunakan `supabaseUser.auth.getClaims()` yang **bukan API resmi** dari supabase-js v2. Method yang benar adalah `supabaseUser.auth.getUser()`.

#### BUG 3: Profiles Kosong -- Data Perlu Diisi Manual
Karena trigger `handle_new_user` tidak pernah terpasang, 4 user yang sudah dibuat tidak punya profil. Data profil perlu diinsert secara manual dari data `auth.users`.

---

### Rencana Perbaikan

#### 1. Database Migration -- Pasang Semua Trigger + Isi Profiles
Satu migration SQL yang akan:
- Pasang trigger `on_auth_user_created` pada `auth.users` AFTER INSERT -> `handle_new_user()`
- Pasang trigger `generate_tracking_code_trigger` pada `data_entries` BEFORE INSERT -> `generate_tracking_code()`
- Pasang trigger `auto_update_status_trigger` pada `data_entries` BEFORE UPDATE -> `auto_update_entry_status()`
- Pasang trigger `log_status_change_trigger` pada `data_entries` AFTER UPDATE -> `log_status_change()`
- Pasang trigger `update_data_entries_updated_at` pada `data_entries` BEFORE UPDATE -> `update_updated_at_column()`
- Insert data profiles yang hilang dari `auth.users` untuk 4 user yang sudah ada

#### 2. Perbaiki Edge Function `create-user`
- Ganti `supabaseUser.auth.getClaims(token)` dengan `supabaseUser.auth.getUser()`
- Ambil user ID dari `data.user.id` bukan dari `claims.claims.sub`

#### 3. Perbaiki Edge Function `delete-user`
- Sama seperti create-user, ganti `getClaims` dengan `getUser()`

### File yang Diubah
- **Database migration** baru (pasang triggers + isi profiles)
- `supabase/functions/create-user/index.ts`
- `supabase/functions/delete-user/index.ts`

