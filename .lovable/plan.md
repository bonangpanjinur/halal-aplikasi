

# Laporan Audit Fitur & Rencana Perbaikan

## A. FITUR YANG SUDAH ADA

| Fitur | Status | Catatan |
|-------|--------|---------|
| Login/Register | Berfungsi | - |
| Role hierarchy (super_admin > owner > admin dst) | Berfungsi | Navigasi & route sudah dipisah per role |
| Kelola User (super_admin & owner) | Berfungsi | Owner hanya lihat user miliknya |
| Kelola Group | Berfungsi | Owner bisa buat & hapus group |
| Data Entry + 4 field akun baru | Berfungsi | email_halal, sandi_halal, email_nib, sandi_nib |
| Status workflow (termasuk revisi, selesai_revisi) | Berfungsi | - |
| Hak akses field per role | Berfungsi | Super admin bisa atur via Pengaturan |
| Komisi per role | Berfungsi | Super admin tidak menerima komisi |
| Dashboard dengan chart | Berfungsi | - |
| Share Link & Public Form | Berfungsi | - |
| Tracking publik | Berfungsi | - |
| UMKM Dashboard + notifikasi | Berfungsi | - |
| Dark mode | Berfungsi | - |
| PWA (manifest + service worker) | Sebagian | Install prompt ada, tapi SW registration perlu diverifikasi |
| Owner billing (invoice otomatis) | Sebagian | Trigger & tabel ada, tapi halaman BillingManagement masih pakai tabel `billing_plans`/`subscriptions` yang belum ada di DB |
| Payment methods (super admin) | Berfungsi | Tabel sudah ada |
| Owner payment methods | Berfungsi | Tabel sudah ada |

---

## B. BUG & MASALAH YANG HARUS DIPERBAIKI

### 1. Groups.tsx: Owner membuat group tanpa `owner_id`
**Severity: Tinggi**
Saat owner membuat group, kode hanya mengirim `{ name, created_by }` tanpa `owner_id`. Akibatnya group tidak ter-scope ke owner tersebut, dan RLS policy `owner_id = auth.uid()` akan memblokir akses owner ke group yang baru dibuat.

### 2. BillingManagement.tsx: Query tabel yang tidak ada
**Severity: Tinggi**
Halaman ini query `billing_plans` dan `subscriptions` yang tidak ada di database. Harusnya menggunakan `owner_billing_rates` dan `owner_invoices` yang sudah ada. Halaman ini sepenuhnya rusak.

### 3. Dashboard: Owner melihat data seperti non-admin
**Severity: Sedang**
Dashboard saat ini hanya membedakan `super_admin` vs "lainnya". Owner seharusnya bisa melihat semua data di grup miliknya, bukan hanya data yang `created_by` dia sendiri. Juga, owner tidak melihat jumlah user miliknya.

### 4. AppSettings: Komisi masih global, bukan per-owner
**Severity: Sedang**
Pengaturan komisi di `AppSettings` menyimpan `commission_rates` tanpa `owner_id`. Padahal tabel sudah punya kolom `owner_id`. Owner yang mengubah komisi akan menimpa setting global, bukan setting miliknya.

### 5. AppSettings: Owner melihat pengaturan yang seharusnya hanya super_admin
**Severity: Sedang**
Owner bisa mengakses tab Tampilan (nama app, warna, logo) dan Hak Akses yang seharusnya hanya domain super_admin. Owner seharusnya hanya bisa atur komisi untuk tim di bawahnya.

### 6. Navigasi Owner: Tidak ada menu Kelola User dan Pengaturan
**Severity: Sedang**
`OWNER_NAV` di AppLayout tidak memiliki menu "Kelola User" dan "Pengaturan", padahal owner harus bisa kelola admin-adminnya dan atur komisi.

### 7. Komisi.tsx: Super admin melihat halaman kosong
**Severity: Rendah**
Super admin bisa navigasi ke halaman Komisi tapi langsung return kosong. Seharusnya super admin bisa melihat ringkasan komisi semua owner.

---

## C. FITUR YANG MASIH KURANG

### 1. Owner tidak bisa kelola hak akses untuk admin-adminnya
Owner seharusnya bisa mengatur field mana yang boleh dilihat/diedit oleh admin di bawahnya. Saat ini hak akses hanya bisa diatur oleh super_admin secara global.

### 2. Super admin belum bisa atur tarif billing per owner
Tidak ada UI bagi super admin untuk mengatur `fee_per_certificate` per owner. Tabel `owner_billing_rates` sudah ada tapi tidak ada halaman untuk mengisinya.

### 3. Super admin belum bisa ubah status invoice owner
Invoice owner otomatis dibuat sebagai "draft" tapi tidak ada UI untuk super admin mengubahnya menjadi "issued" atau "paid".

### 4. Owner belum bisa kelola anggota group
Meskipun owner bisa buat group, kemampuan menambah/menghapus member di GroupDetail perlu diverifikasi apakah sudah ter-scope ke owner.

---

## D. RENCANA PERBAIKAN (Urutan Prioritas)

### Tahap 1: Perbaikan Bug Kritis
1. **Fix Groups.tsx** - Tambah `owner_id: user.id` saat owner membuat group
2. **Fix BillingManagement.tsx** - Rewrite untuk menggunakan `owner_billing_rates` dan `owner_invoices`, tambah fitur atur tarif per owner dan ubah status invoice
3. **Fix AppSettings komisi** - Owner menyimpan `commission_rates` dengan `owner_id`, super admin tanpa `owner_id` (atau global)

### Tahap 2: Perbaikan Navigasi & Akses
4. **Tambah menu Owner** - Tambahkan "Kelola User" dan "Pengaturan" ke `OWNER_NAV`
5. **Pisah tab pengaturan** - Owner hanya lihat tab Komisi di AppSettings, super admin lihat semua
6. **Fix Dashboard owner** - Owner melihat statistik semua data di grup miliknya + jumlah user miliknya

### Tahap 3: Fitur Baru
7. **UI tarif billing per owner** - Super admin bisa set `fee_per_certificate` untuk setiap owner dari halaman Penagihan
8. **UI ubah status invoice** - Super admin bisa mengubah status invoice dari draft → issued → paid
9. **Ringkasan komisi untuk super admin** - Super admin melihat total komisi per owner

### Detail Teknis per Perbaikan

**Fix 1 (Groups.tsx):** Ubah `insert({ name, created_by })` menjadi `insert({ name, created_by, owner_id: role === 'owner' ? user.id : undefined })`

**Fix 2 (BillingManagement.tsx):** Rewrite total - query `owner_billing_rates` + `owner_invoices` + `profiles` untuk daftar owner, tambah form edit tarif dan tombol ubah status invoice

**Fix 3 (AppSettings komisi):** Saat load, filter `commission_rates` by `owner_id` (owner) atau tanpa filter (super_admin). Saat save, sertakan `owner_id` untuk owner.

**Fix 4 (AppLayout):** Tambahkan `{ label: "Kelola User", icon: Users, path: "/users" }` dan `{ label: "Pengaturan", icon: Settings, path: "/settings" }` ke `OWNER_NAV`

**Fix 5 (AppSettings):** Cek `role` untuk menentukan tab mana yang ditampilkan. Owner hanya lihat tab Komisi.

**Fix 6 (Dashboard):** Untuk role owner, query entries via `groups.owner_id = user.id` join, tampilkan count user milik owner.

### Estimasi

| Perbaikan | Effort |
|-----------|--------|
| Fix Groups + navigasi | Kecil |
| Fix BillingManagement rewrite | Sedang |
| Fix AppSettings komisi scoped | Sedang |
| Fix Dashboard owner | Sedang |
| Total | ~1 sesi implementasi |

