

# Daftar Bug & Rencana Perbaikan

## Bug yang Ditemukan

### 1. OwnerBilling.tsx: `.single()` crash ketika belum ada billing rate
**Severity: Tinggi**
Baris 51 menggunakan `.single()` untuk query `owner_billing_rates`. Jika owner belum punya rate, query akan error dan halaman crash. Harus diganti `.maybeSingle()`.

### 2. AppSettings Komisi: Owner melihat semua role termasuk super_admin dan owner
**Severity: Sedang**
Owner seharusnya hanya bisa mengatur komisi untuk role di bawahnya (admin, admin_input, lapangan, nib). Saat ini semua role termasuk super_admin dan owner tampil di tab Komisi untuk owner.

### 3. AppSettings Komisi: `onConflict: "role"` salah untuk owner
**Severity: Sedang**
Baris 234: ketika super_admin menyimpan rates, `onConflict: "role"` tidak mencakup `owner_id`. Unique constraint di tabel kemungkinan `(role, owner_id)`, jadi super_admin tanpa `owner_id` bisa gagal upsert atau menimpa data. Perlu diperbaiki logic upsert agar benar.

### 4. Komisi.tsx: Owner hanya lihat komisi sendiri, tidak bisa lihat komisi semua user di bawahnya
**Severity: Sedang**
Owner yang `canManageCommissions = true` seharusnya bisa lihat komisi semua user di bawahnya. Tapi query `fetchUsers` di baris 96 mengambil semua profiles tanpa filter `owner_id`, sehingga dropdown user tidak terscope.

### 5. ShareLinks.tsx: Hanya menampilkan link milik user sendiri
**Severity: Rendah**
Owner seharusnya bisa melihat semua shared links di grup miliknya, bukan hanya yang `user_id = user.id`.

### 6. GroupDetail.tsx: Status config tidak lengkap
**Severity: Rendah**
`STATUS_CONFIG` di GroupDetail hanya punya 7 status, tidak termasuk `siap_input` dalam daftar yang bisa ditampilkan oleh filter/badge meskipun ada di enum. Beberapa status lain juga belum masuk (`nib_selesai`, `terverifikasi`, `ktp_terdaftar_sertifikat`).

---

## Rencana Perbaikan

### File yang akan diubah:

**1. `src/pages/OwnerBilling.tsx`**
- Ganti `.single()` → `.maybeSingle()` di query `owner_billing_rates`

**2. `src/pages/AppSettings.tsx`**
- Filter daftar role di tab Komisi: owner hanya lihat `admin`, `admin_input`, `lapangan`, `nib`
- Perbaiki upsert logic: untuk super_admin tanpa owner_id, pastikan conflict handling benar

**3. `src/pages/Komisi.tsx`**
- Scope `fetchUsers` untuk owner: filter profiles by `owner_id = user.id`
- Owner bisa melihat komisi semua user di bawahnya, bukan hanya komisi sendiri

**4. `src/pages/ShareLinks.tsx`**
- Owner: tampilkan semua shared links dari grup milik owner (bukan hanya `user_id = user.id`)

**5. `src/pages/GroupDetail.tsx`**
- Tambahkan status yang hilang ke `STATUS_CONFIG`: `siap_input` sudah ada tapi status lain (`nib_selesai`, `terverifikasi`, `ktp_terdaftar_sertifikat`) belum ada di config

