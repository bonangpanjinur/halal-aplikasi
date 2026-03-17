# Role Hierarchy dan Permission Model

## Overview

Aplikasi Halal menggunakan model role-based access control (RBAC) dengan hirarki multi-level. Dokumen ini menjelaskan struktur role, hirarki, dan permission untuk setiap role.

## Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPER_ADMIN                            │
│  (Platform Administrator - Full Access Across All Tenants)  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌────────┐
    │ OWNER  │      │ ADMIN  │      │ LAPANG │
    │ (Tenant│      │(Tenant │      │ AN     │
    │ Owner) │      │ Admin) │      │(Field) │
    └────┬───┘      └────┬───┘      └────────┘
         │               │
    ┌────┴────┬──────────┴───┐
    │          │              │
    ▼          ▼              ▼
┌──────────┐ ┌───┐      ┌─────────┐
│ADMIN_    │ │NIB│      │ UMKM    │
│INPUT     │ └───┘      │(End User)
│(Data     │            └─────────┘
│Entry)    │
└──────────┘
```

## Role Descriptions

### 1. SUPER_ADMIN

**Deskripsi**: Platform administrator dengan akses penuh ke semua tenant dan konfigurasi global.

**Akses**:
- Manage semua owner (create, edit, delete)
- Manage semua user di semua tenant
- Manage semua group di semua tenant
- Manage semua data entries di semua tenant
- Manage global settings (app name, logo, color)
- Manage global field access rules
- Manage global commission rates
- Manage owner billing rates dan invoices
- View audit logs semua tenant
- No commission (tidak menerima komisi)

**Navigasi**: Dashboard, Kelola User, Group Halal, Share Link, Komisi, Pengaturan

**Database Scope**: Akses penuh lintas semua owner

---

### 2. OWNER

**Deskripsi**: Pemilik tenant yang mengelola operasional tenant-nya sendiri.

**Akses**:
- Manage admin, admin_input, lapangan, nib di tenant-nya
- Tidak bisa manage super_admin atau owner lain
- Manage group di tenant-nya
- Manage data entries di tenant-nya
- Manage commission rates untuk role di bawahnya
- View invoices tenant-nya
- View audit logs tenant-nya
- Tidak bisa akses global settings

**Navigasi**: Dashboard, Group Halal, Share Link, Komisi

**Database Scope**: Hanya data dengan owner_id = user.id

**Pembatasan**:
- Tidak bisa create/delete owner
- Tidak bisa create super_admin
- Tidak bisa akses settings global
- Tidak bisa manage owner lain

---

### 3. ADMIN

**Deskripsi**: Administrator tenant yang membantu owner mengelola operasional.

**Akses**:
- Manage admin_input, lapangan, nib di tenant-nya
- Tidak bisa manage owner atau admin lain
- Manage group di tenant-nya
- Manage data entries di tenant-nya
- View commission rates (read-only)
- View audit logs tenant-nya

**Navigasi**: Dashboard, Group Halal, Share Link, Komisi

**Database Scope**: Hanya data dengan owner_id = user.owner_id

**Pembatasan**:
- Tidak bisa create/delete owner atau admin
- Tidak bisa manage commission rates
- Tidak bisa akses settings

---

### 4. ADMIN_INPUT

**Deskripsi**: Administrator input yang fokus pada entry data.

**Akses**:
- Create dan edit data entries
- View group di tenant-nya
- Tidak bisa manage user

**Navigasi**: Dashboard, Group Halal

**Database Scope**: Hanya data dengan owner_id = user.owner_id

**Pembatasan**:
- Tidak bisa delete data entries
- Tidak bisa manage user
- Tidak bisa akses komisi atau settings

---

### 5. LAPANGAN

**Deskripsi**: Operator lapangan yang melakukan verifikasi lapangan.

**Akses**:
- View dan update data entries untuk verifikasi
- Upload foto verifikasi
- View group di tenant-nya

**Navigasi**: Dashboard, Group Halal, Share Link, Komisi

**Database Scope**: Hanya data dengan owner_id = user.owner_id

**Pembatasan**:
- Tidak bisa delete data entries
- Tidak bisa manage user
- Tidak bisa akses settings

---

### 6. NIB

**Deskripsi**: Operator NIB yang melakukan verifikasi NIB.

**Akses**:
- View dan update data entries untuk verifikasi NIB
- Upload dokumen NIB
- View group di tenant-nya

**Navigasi**: Dashboard, Group Halal, Share Link, Komisi

**Database Scope**: Hanya data dengan owner_id = user.owner_id

**Pembatasan**:
- Tidak bisa delete data entries
- Tidak bisa manage user
- Tidak bisa akses settings

---

### 7. UMKM

**Deskripsi**: End user (UMKM) yang mengajukan sertifikat halal.

**Akses**:
- View status aplikasi sendiri
- Upload dokumen untuk aplikasi sendiri
- View tracking code

**Navigasi**: Status Saya

**Database Scope**: Hanya data entries milik user sendiri

**Pembatasan**:
- Tidak bisa view data entries lain
- Tidak bisa manage user
- Tidak bisa akses settings

---

## Permission Matrix

| Permission | Super Admin | Owner | Admin | Admin Input | Lapangan | NIB | UMKM |
|-----------|:-----------:|:-----:|:-----:|:-----------:|:--------:|:---:|:----:|
| Create User | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete User | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Owner | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Group | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Group | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Entry | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Edit Entry | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete Entry | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change Status | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Audit Log | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Commission | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Commission | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

---

## Data Scope Rules

### Super Admin
- **Scope**: Lintas semua tenant (owner_id dapat NULL atau apapun)
- **Filter**: Tidak ada filter owner_id
- **Visibility**: Semua data

### Owner
- **Scope**: Hanya tenant milik user (owner_id = user.id)
- **Filter**: WHERE owner_id = auth.uid()
- **Visibility**: Data dalam tenant sendiri

### Admin / Admin Input / Lapangan / NIB
- **Scope**: Hanya tenant milik owner mereka (owner_id = user.owner_id)
- **Filter**: WHERE owner_id = (SELECT owner_id FROM profiles WHERE id = auth.uid())
- **Visibility**: Data dalam tenant owner mereka

### UMKM
- **Scope**: Hanya data entries milik user (created_by = user.id atau umkm_user_id = user.id)
- **Filter**: WHERE created_by = auth.uid() OR umkm_user_id = auth.uid()
- **Visibility**: Hanya aplikasi sendiri

---

## Field Access Control

Field access diatur per role melalui tabel `field_access`. Setiap role dapat dikonfigurasi untuk:
- `can_view`: Bisa melihat field
- `can_edit`: Bisa mengedit field

**Super Roles**: Super Admin dan Owner otomatis bisa view/edit semua field untuk data dalam scope mereka.

**Other Roles**: Mengikuti konfigurasi di tabel `field_access`.

---

## Status Workflow

Setiap data entry memiliki status yang mengikuti workflow:

```
belum_lengkap
    ↓
siap_input
    ↓
lengkap
    ↓
terverifikasi
    ├→ ktp_terdaftar_nib
    │   ↓
    │   pengajuan
    │   ├→ sertifikat_selesai ✅
    │   └→ revisi ↔ selesai_revisi
    │
    └→ ktp_terdaftar_sertifikat
        ↓
        sertifikat_selesai ✅
```

### Status Permissions

| Status | Super Admin | Owner | Admin | Admin Input | Lapangan | NIB |
|--------|:-----------:|:-----:|:-----:|:-----------:|:--------:|:---:|
| → belum_lengkap | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| → siap_input | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| → lengkap | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| → terverifikasi | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| → pengajuan | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| → sertifikat_selesai | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| → revisi | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| → selesai_revisi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Commission Model

### Current Model (Fase 1)
- Commission rates disimpan per role
- Scope: Per owner (owner_id di commission_rates table)
- Owner dapat set commission untuk role di bawahnya
- Super admin tidak menerima komisi

### Future Model (Fase 5)
- Commission akan di-calculate berdasarkan owner + role
- Owner billing akan otomatis di-generate saat sertifikat selesai
- Multi-owner billing dengan invoice per owner

---

## Implementation Notes

1. **RLS Policies**: Semua akses data di-enforce melalui RLS policies di Supabase
2. **Frontend Validation**: Frontend juga melakukan validation untuk UX yang lebih baik
3. **Owner Scope**: Disimpan di kolom `owner_id` di tabel: profiles, groups, commission_rates
4. **Audit Logging**: Semua perubahan status dicatat di audit_logs

---

## Migration Path

Dari struktur saat ini ke struktur target:

1. **Fase 1**: Refactor frontend untuk respect owner scope (dokumentasi ini)
2. **Fase 2**: Implement role dan hirarki yang benar
3. **Fase 3**: Add field akun baru dan status revisi
4. **Fase 4**: Aktivasi PWA dan adjust komisi
5. **Fase 5**: Implement multi-owner billing

---

## References

- `src/contexts/AuthContext.tsx` - Auth context dengan role
- `src/hooks/useFieldAccess.ts` - Field access control
- `src/pages/UsersManagement.tsx` - User management
- `supabase/migrations/20260317082150_*.sql` - Owner scope migration
