

## Analisis Bug dan Rencana Perbaikan

### Bug Utama: Form "Tambah Data Baru" Kosong (Tidak Ada Field)

**Penyebab**: `useFieldAccess` hook mengambil data dari tabel `field_access`, tapi tabel ini **kosong** untuk role `super_admin` (terlihat dari network request yang return `[]`). Default `canEdit()` return `false`, sehingga semua field tersembunyi.

**Solusi**: Di `useFieldAccess`, jika role adalah `super_admin` atau `admin`, `canEdit` dan `canView` harus selalu return `true` (bypass field_access check). Super admin seharusnya bisa akses semua field tanpa perlu konfigurasi.

### Bug Lainnya yang Ditemukan

1. **fetchEntries filter terlalu ketat**: Line 120 - untuk role selain `super_admin`, query difilter `created_by = user.id`. Ini berarti `admin`, `lapangan`, `nib`, `admin_input` hanya melihat entri yang mereka buat sendiri, padahal mereka seharusnya bisa melihat semua entri dalam grup (sudah diatur oleh RLS). Harusnya hanya filter untuk non-member roles.

2. **Console warning: forwardRef pada Select di GroupDetail** - Select component digunakan langsung sebagai child tanpa wrapping, menghasilkan warning. Minor issue.

3. **Dialog tanpa DialogDescription** - Console warning `Missing Description or aria-describedby` pada dialog di GroupDetail. Perlu tambah `DialogDescription`.

### Rencana Implementasi

**Task 1: Fix useFieldAccess - Super admin/admin bypass**
- Di `useFieldAccess.ts`, ubah `canView` dan `canEdit` agar return `true` untuk `super_admin` dan `admin` ketika tidak ada field_access records yang dikonfigurasi, atau selalu `true` untuk super_admin.

**Task 2: Fix fetchEntries filter di GroupDetail**
- Hapus filter `created_by` yang terlalu ketat. Biarkan RLS yang mengatur akses. Atau batasi filter hanya untuk role yang memang perlu (misalnya `lapangan` hanya lihat miliknya).

**Task 3: Fix minor warnings**
- Tambah `DialogDescription` pada dialog di GroupDetail yang missing.

### File yang Akan Diubah
- `src/hooks/useFieldAccess.ts` - bypass untuk super_admin/admin
- `src/pages/GroupDetail.tsx` - fix fetchEntries filter, fix dialog warnings

