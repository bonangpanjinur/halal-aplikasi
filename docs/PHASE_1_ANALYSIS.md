# Fase 1: Analisis dan Restrukturisasi Rencana Perbaikan

**Tanggal Analisis**: 17 Maret 2026  
**Status**: Selesai

## 1. Ringkasan Eksekutif

Fase 1 merupakan fase analisis mendalam terhadap struktur kode aplikasi Halal yang ada. Analisis ini mengidentifikasi:

- Struktur role dan hirarki pengguna yang saat ini masih ambigu
- Implementasi owner yang masih setara dengan super_admin
- Kebutuhan refactoring untuk mendukung model multi-tenant
- Persiapan infrastruktur untuk fase-fase selanjutnya

## 2. Analisis Struktur Kode Saat Ini

### 2.1 Struktur Proyek

```
halal-aplikasi/
├── src/
│   ├── components/
│   │   ├── AppLayout.tsx          # Layout utama dengan navigasi
│   │   ├── DataEntryForm.tsx      # Form input data
│   │   └── ui/                    # Komponen UI reusable
│   ├── contexts/
│   │   └── AuthContext.tsx        # Context untuk autentikasi & role
│   ├── hooks/
│   │   └── useFieldAccess.ts      # Hook untuk kontrol akses field
│   ├── pages/
│   │   ├── UsersManagement.tsx    # Manajemen user
│   │   ├── AppSettings.tsx        # Pengaturan global
│   │   ├── GroupDetail.tsx        # Detail grup
│   │   ├── UmkmDashboard.tsx      # Dashboard UMKM
│   │   └── ...                    # Halaman lainnya
│   └── integrations/supabase/     # Integrasi Supabase
├── supabase/
│   ├── migrations/                # Database migrations
│   └── functions/                 # Edge functions
└── package.json
```

### 2.2 Role dan Hirarki Saat Ini

**Roles yang Didefinisikan** (dari `types.ts`):
- `super_admin` - Administrator tertinggi
- `owner` - Pemilik tenant (baru ditambahkan)
- `admin` - Administrator grup
- `admin_input` - Admin input data
- `lapangan` - Operator lapangan
- `nib` - Operator NIB
- `umkm` - Pengguna UMKM

**Masalah Identifikasi**:

1. **Owner Masih Setara Super Admin**
   - Di `AppLayout.tsx` (baris 36): `owner: SUPER_NAV` → owner memiliki akses yang sama dengan super_admin
   - Di `useFieldAccess.ts` (baris 17): `isSuperRole` mencakup `owner` → owner dianggap "super role"
   - Di `AppSettings.tsx` (baris 223): Hanya super_admin dan owner yang bisa akses settings

2. **Field Access Control Masih Global**
   - `field_access` table tidak memiliki kolom `owner_id`
   - Semua owner berbagi konfigurasi field access yang sama
   - Tidak ada scoping per owner untuk kontrol granular

3. **Commission Rates Sudah Partial Scoped**
   - `commission_rates` table sudah memiliki `owner_id` (dari migration terbaru)
   - Namun, UI di `AppSettings.tsx` masih global

## 3. Analisis Database Schema

### 3.1 Tabel Kunci

#### `profiles`
```sql
- id (UUID, PK)
- email
- full_name
- owner_id (UUID, FK ke profiles) -- Baru ditambahkan
- role (via user_roles)
```

**Status**: Sudah ada owner_id, tapi belum fully utilized di frontend

#### `groups`
```sql
- id (UUID, PK)
- name
- owner_id (UUID, FK ke profiles) -- Baru ditambahkan
```

**Status**: Owner scope sudah ada di database

#### `data_entries`
```sql
- id (UUID, PK)
- group_id (FK)
- email, kata_sandi (legacy)
- email_halal, sandi_halal (baru)
- email_nib, sandi_nib (baru)
- status (enum: belum_lengkap, siap_input, ..., revisi, selesai_revisi)
```

**Status**: Field akun baru sudah ada, status revisi sudah ada

#### `commission_rates`
```sql
- id (UUID, PK)
- role (enum app_role)
- amount_per_entry
- owner_id (UUID, FK) -- Baru ditambahkan
```

**Status**: Sudah scoped per owner di database

#### `owner_billing_rates` (Baru)
```sql
- id (UUID, PK)
- owner_id (UUID, FK)
- fee_per_certificate
- updated_at, updated_by
```

**Status**: Baru ditambahkan di migration terbaru

#### `owner_invoices` (Baru)
```sql
- id (UUID, PK)
- owner_id (UUID, FK)
- period, status, total_amount
- issued_at, paid_at, notes
```

**Status**: Baru ditambahkan di migration terbaru

#### `owner_invoice_items` (Baru)
```sql
- id (UUID, PK)
- invoice_id (FK)
- owner_id (FK)
- entry_id (FK)
- amount, description
```

**Status**: Baru ditambahkan di migration terbaru

### 3.2 RLS Policies

**Status Database**: RLS policies untuk owner sudah ditambahkan di migration terbaru:
- Owners dapat view/manage owned users
- Owners dapat manage own groups dan group members
- Owners dapat access entries dalam own groups
- Owners dapat view scoped commission rates

**Status Frontend**: Belum sepenuhnya memanfaatkan RLS policies yang ada

## 4. Analisis Frontend

### 4.1 AuthContext.tsx

**Fungsi Utama**:
- Fetch user session dari Supabase Auth
- Fetch role dari `user_roles` table
- Provide user, session, role ke seluruh aplikasi

**Masalah**:
- Tidak fetch `owner_id` dari profile
- Context hanya menyimpan role, tidak menyimpan owner scope

**Rekomendasi**:
- Extend AuthContext untuk menyimpan `owner_id`
- Fetch owner_id saat fetch role

### 4.2 AppLayout.tsx

**Fungsi Utama**:
- Render sidebar/bottom nav berdasarkan role
- Fetch app settings (name, logo, color)

**Masalah**:
- `owner: SUPER_NAV` (baris 36) → owner memiliki akses penuh seperti super_admin
- Tidak ada perbedaan navigasi antara super_admin dan owner

**Rekomendasi**:
- Buat `OWNER_NAV` yang lebih terbatas
- Owner tidak perlu akses "Kelola User" (hanya manage users miliknya)
- Owner tidak perlu akses "Pengaturan" global (hanya owner settings)

### 4.3 UsersManagement.tsx

**Fungsi Utama**:
- List users
- Create user (assign role dan owner)
- Delete user

**Masalah**:
- Owner bisa create user dengan role apapun (termasuk owner)
- Tidak ada pembatasan owner untuk hanya manage users miliknya
- Super admin bisa assign user ke owner manapun

**Rekomendasi**:
- Owner hanya bisa create: admin, admin_input, lapangan, nib
- Owner tidak bisa create: super_admin, owner, umkm
- Super admin bisa create semua role
- Filter users berdasarkan owner_id untuk owner

### 4.4 AppSettings.tsx

**Fungsi Utama**:
- Manage app name, logo, primary color
- Manage field access per role
- Manage siap_input required fields
- Manage commission rates per role

**Masalah**:
- Semua pengaturan bersifat global (shared semua owner)
- Owner tidak bisa set commission rates untuk admin-adminnya sendiri
- Field access tidak bisa di-customize per owner

**Rekomendasi**:
- Split settings menjadi 2 level:
  - Super Admin Settings: global + owner management
  - Owner Settings: commission rates untuk role di bawahnya
- Buat separate page/tab untuk owner settings

### 4.5 useFieldAccess.ts

**Fungsi Utama**:
- Check apakah role bisa view/edit field tertentu

**Masalah**:
- `isSuperRole` includes owner → owner otomatis bisa semua field
- Tidak ada scoping per owner

**Rekomendasi**:
- Separate `super_admin` dari `owner` dalam `isSuperRole`
- Owner hanya bisa semua field untuk data miliknya
- Implement owner-scoped field access

## 5. Analisis Fitur Baru yang Sudah Ada

### 5.1 Credential Fields Baru

**Status**: Sudah ada di database
- `email_halal`, `sandi_halal`
- `email_nib`, `sandi_nib`

**Frontend Status**: Belum fully integrated
- `DataEntryForm.tsx` perlu update untuk show/edit field baru
- `GroupDetail.tsx` perlu update untuk display field baru

### 5.2 Status Revisi

**Status**: Sudah ada di database
- `revisi` status
- `selesai_revisi` status

**Frontend Status**: Belum fully integrated
- UI belum menampilkan status baru
- Workflow belum jelas

### 5.3 Owner Billing

**Status**: Database structure sudah ada
- `owner_billing_rates` table
- `owner_invoices` table
- `owner_invoice_items` table

**Frontend Status**: Belum ada UI
- Perlu create page untuk manage billing
- Perlu create page untuk view invoices

## 6. Rencana Refactoring Fase 1

### 6.1 Prioritas Tinggi (Wajib)

1. **Extend AuthContext**
   - Tambah `owner_id` ke context
   - Fetch owner_id saat login

2. **Update AppLayout Navigation**
   - Buat `OWNER_NAV` yang berbeda dari `SUPER_NAV`
   - Owner tidak perlu "Kelola User" dan "Pengaturan" global

3. **Fix useFieldAccess**
   - Separate `super_admin` dari `owner` dalam logic
   - Owner hanya bisa semua field untuk data miliknya

4. **Refactor UsersManagement**
   - Pembatasan role yang bisa di-create per role
   - Filter users berdasarkan owner scope

### 6.2 Prioritas Sedang (Penting)

5. **Split AppSettings**
   - Create separate Owner Settings page
   - Super Admin Settings untuk global config
   - Owner Settings untuk commission rates

6. **Update DataEntryForm**
   - Add support untuk field akun baru
   - Show/hide field berdasarkan field access

7. **Update GroupDetail**
   - Display status revisi/selesai_revisi
   - Show workflow yang benar

### 6.3 Prioritas Rendah (Optional)

8. **Create Owner Billing Pages**
   - Billing rates management
   - Invoice viewing

## 7. Kesimpulan

Fase 1 analisis menunjukkan bahwa:

1. **Database schema** sudah cukup siap untuk multi-tenant (owner scope sudah ada)
2. **RLS policies** sudah ditambahkan untuk owner scope
3. **Frontend** masih perlu significant refactoring untuk:
   - Respect owner scope di UI
   - Separate owner dari super_admin dalam logic
   - Implement owner-scoped settings

4. **Pekerjaan Fase 1** fokus pada:
   - Dokumentasi struktur saat ini
   - Identifikasi masalah
   - Persiapan untuk refactoring di fase selanjutnya

## 8. Deliverables Fase 1

- ✅ Analisis struktur kode
- ✅ Identifikasi masalah
- ✅ Database schema review
- ✅ Frontend architecture review
- ✅ Rencana refactoring terstruktur
- ✅ Dokumentasi ini

## 9. Next Steps (Fase 2)

Fase 2 akan fokus pada implementasi:
1. Extend AuthContext dengan owner_id
2. Update AppLayout dengan OWNER_NAV
3. Refactor UsersManagement
4. Fix useFieldAccess logic
5. Commit changes ke GitHub
