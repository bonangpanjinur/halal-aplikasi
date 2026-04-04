

# Audit Fitur & Bug — Rencana Perbaikan

## A. DAFTAR FITUR: SUDAH ADA vs BELUM ADA

| Fitur | Status | Catatan |
|-------|--------|---------|
| Login / Register | Ada | - |
| Role hierarchy (super_admin > owner > admin > ...) | Ada | - |
| Kelola User (CRUD, ubah role, reset password) | Ada | - |
| Kelola Group (CRUD) | Ada | - |
| Data Entry (CRUD, upload foto, multi-foto) | Ada | - |
| Status workflow (11 status) | Ada | - |
| Share Link (buat, QR, copy, toggle aktif) | Ada | PIC belum bisa dipilih |
| Komisi (lihat, bayar) | Ada | - |
| Dashboard & chart | Ada | - |
| Audit Log | Ada | - |
| Tracking publik | Ada | - |
| Public Form via share link | Ada | PIC = pembuat link |
| Billing / Tagihan (owner & super_admin) | Ada | - |
| Pengaturan (branding, field access, komisi rate) | Ada | - |
| Download / Export CSV | Ada | - |
| **Owner tambah anggota ke group** | **BELUM** | Hanya super_admin yang bisa |
| **Share Link: pilih PIC** | **BELUM** | Selalu pakai user_id pembuat |
| **Owner lihat tab Anggota & Audit di group** | **BELUM** | Tab hanya muncul untuk super_admin & admin |

## B. DAFTAR BUG

### Bug 1: Owner tidak bisa tambah/hapus anggota group
**Severity: Tinggi**
Di `GroupDetail.tsx` baris 455-456, tab "Anggota" hanya tampil jika `role === "super_admin" || role === "admin"`. Owner tidak termasuk. Bahkan tombol "Tambah Anggota" (baris 745) hanya muncul untuk `super_admin`. Owner seharusnya punya kontrol penuh atas group miliknya.

### Bug 2: Share Link tidak punya pilihan PIC
**Severity: Sedang**
Saat membuat share link, `user_id` otomatis diisi dengan user yang sedang login. Tidak ada opsi untuk memilih PIC (petugas lapangan/admin) yang bertanggung jawab atas data yang masuk via link tersebut.

### Bug 3: Owner tidak bisa lihat tab Audit Log di group
**Severity: Rendah**
Tab Audit Log (baris 458) hanya muncul untuk `super_admin` dan `admin`. Owner seharusnya juga bisa melihat riwayat perubahan data di group miliknya.

### Bug 4: `fetchAvailableUsers` tidak di-scope untuk owner
**Severity: Sedang**
Di `GroupDetail.tsx` baris 192-196, saat menambah anggota, semua profile ditampilkan tanpa filter. Owner seharusnya hanya melihat user miliknya (`owner_id = user.id`).

### Bug 5: Link UMKM hanya bisa oleh super_admin & admin
**Severity: Rendah**
Tombol "Hubungkan ke Akun UMKM" (baris 685) hanya muncul untuk `super_admin` dan `admin`. Owner seharusnya juga bisa menghubungkan entri ke akun UMKM.

### Bug 6: Dashboard "Link Aktif" hanya hitung link milik sendiri
**Severity: Rendah**
Di `Dashboard.tsx` baris 176-180, jumlah link dihitung dengan `eq("user_id", user.id)`. Untuk owner, seharusnya menghitung semua link di group miliknya.

---

## C. RENCANA PERBAIKAN

### File 1: `src/pages/GroupDetail.tsx`
- **Tab Anggota**: Tambahkan `role === "owner"` ke kondisi tampil tab Anggota dan Audit Log
- **Tombol Tambah Anggota**: Izinkan owner (bukan hanya super_admin) untuk menambah & menghapus anggota
- **fetchAvailableUsers**: Jika role owner, filter profiles dengan `owner_id = user.id` agar hanya menampilkan user milik owner
- **Link UMKM**: Tambahkan `role === "owner"` ke kondisi tombol hubungkan UMKM

### File 2: `src/pages/ShareLinks.tsx`
- Tambahkan dropdown **PIC** saat membuat link baru: owner/admin bisa memilih user mana yang menjadi PIC untuk link tersebut
- Fetch daftar user yang tersedia (scoped by owner) untuk dropdown PIC
- Tampilkan kolom **PIC** di tabel share links
- Saat create, simpan `user_id` sesuai PIC yang dipilih (bukan selalu current user)

### File 3: `src/pages/Dashboard.tsx`
- Untuk owner, hitung link aktif dari semua link di group miliknya (bukan hanya `user_id = user.id`)

### Estimasi
| Perbaikan | Effort |
|-----------|--------|
| GroupDetail: owner akses anggota + audit | Kecil |
| GroupDetail: scope available users | Kecil |
| ShareLinks: tambah PIC selector | Sedang |
| Dashboard: fix link count | Kecil |

