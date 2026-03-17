# Fase 1: Refactoring Checklist

## Prioritas Tinggi (Wajib untuk Fase 1)

### 1. Extend AuthContext dengan owner_id

**File**: `src/contexts/AuthContext.tsx`

**Perubahan**:
- Tambah `owner_id` ke `AuthContextType` interface
- Fetch `owner_id` dari `profiles` table saat fetch role
- Provide `owner_id` ke seluruh aplikasi

**Checklist**:
- [ ] Update interface `AuthContextType`
- [ ] Update `fetchRole` untuk juga fetch owner_id
- [ ] Update state untuk menyimpan owner_id
- [ ] Update provider value
- [ ] Test di browser

---

### 2. Update AppLayout Navigation

**File**: `src/components/AppLayout.tsx`

**Perubahan**:
- Buat `OWNER_NAV` yang berbeda dari `SUPER_NAV`
- Owner tidak perlu: "Kelola User", "Pengaturan"
- Owner bisa: Dashboard, Group Halal, Share Link, Komisi

**Checklist**:
- [ ] Create OWNER_NAV constant
- [ ] Update NAV_ITEMS mapping
- [ ] Test navigation untuk super_admin
- [ ] Test navigation untuk owner
- [ ] Test navigation untuk admin

---

### 3. Fix useFieldAccess Logic

**File**: `src/hooks/useFieldAccess.ts`

**Perubahan**:
- Separate `super_admin` dari `owner` dalam `isSuperRole`
- Owner hanya bisa semua field untuk data miliknya (via RLS)
- Super admin tetap bisa semua field

**Checklist**:
- [ ] Update `isSuperRole` logic
- [ ] Test canView untuk super_admin
- [ ] Test canView untuk owner
- [ ] Test canView untuk admin
- [ ] Test canEdit untuk masing-masing role

---

### 4. Refactor UsersManagement

**File**: `src/pages/UsersManagement.tsx`

**Perubahan**:
- Pembatasan role yang bisa di-create per role:
  - Super Admin: bisa create semua role
  - Owner: hanya bisa create admin, admin_input, lapangan, nib
  - Admin: hanya bisa create admin_input, lapangan, nib
- Filter users berdasarkan owner scope
- Owner tidak bisa delete owner lain

**Checklist**:
- [ ] Update `ROLE_OPTIONS` filtering logic
- [ ] Add role restriction untuk create
- [ ] Update `fetchUsers` untuk filter by owner_id
- [ ] Update `canDeleteUser` logic
- [ ] Update UI untuk show owner column hanya untuk super_admin
- [ ] Test create user sebagai super_admin
- [ ] Test create user sebagai owner
- [ ] Test delete user permissions

---

## Prioritas Sedang (Penting untuk Fase 2)

### 5. Split AppSettings

**File**: `src/pages/AppSettings.tsx` (refactor)

**Perubahan**:
- Separate Super Admin Settings dan Owner Settings
- Create new page `src/pages/OwnerSettings.tsx`
- Super Admin Settings: global config + owner management
- Owner Settings: commission rates untuk role di bawahnya

**Checklist**:
- [ ] Create OwnerSettings.tsx
- [ ] Move commission rates logic ke OwnerSettings
- [ ] Update AppSettings untuk hanya super_admin
- [ ] Add OwnerSettings route ke App.tsx
- [ ] Add OwnerSettings ke OWNER_NAV (jika perlu)
- [ ] Test as super_admin
- [ ] Test as owner

---

### 6. Update DataEntryForm

**File**: `src/components/DataEntryForm.tsx`

**Perubahan**:
- Add support untuk field akun baru (email_halal, sandi_halal, email_nib, sandi_nib)
- Show/hide field berdasarkan field access
- Maintain backward compatibility dengan field lama

**Checklist**:
- [ ] Add new fields ke form
- [ ] Add field access checks
- [ ] Test display untuk super_admin
- [ ] Test display untuk owner
- [ ] Test display untuk admin_input
- [ ] Test save new fields

---

### 7. Update GroupDetail

**File**: `src/pages/GroupDetail.tsx`

**Perubahan**:
- Display status revisi dan selesai_revisi
- Show workflow yang benar
- Update status transition logic

**Checklist**:
- [ ] Add new status ke status display
- [ ] Update status transition logic
- [ ] Test status change
- [ ] Test audit log untuk new status

---

## Prioritas Rendah (Optional untuk Fase 1)

### 8. Create Owner Billing Pages

**Files**: 
- `src/pages/OwnerBillingRates.tsx` (new)
- `src/pages/OwnerInvoices.tsx` (new)

**Perubahan**:
- Create page untuk manage owner billing rates
- Create page untuk view owner invoices

**Checklist**:
- [ ] Create OwnerBillingRates.tsx
- [ ] Create OwnerInvoices.tsx
- [ ] Add routes ke App.tsx
- [ ] Test as owner
- [ ] Test as super_admin

---

## Documentation & Testing

### 9. Update Documentation

**Files**:
- `docs/PHASE_1_ANALYSIS.md` ✅ (sudah dibuat)
- `docs/ARCHITECTURE.md` (create/update)
- `docs/ROLE_HIERARCHY.md` (create)

**Checklist**:
- [ ] Create ARCHITECTURE.md
- [ ] Create ROLE_HIERARCHY.md
- [ ] Document owner scope
- [ ] Document field access rules

---

### 10. Testing

**Checklist**:
- [ ] Manual test semua role
- [ ] Test user creation permissions
- [ ] Test data access per owner
- [ ] Test field visibility per role
- [ ] Test navigation per role
- [ ] Browser console: no errors
- [ ] Test RLS policies di Supabase

---

## Summary

| Task | Priority | Status | Estimated Hours |
|------|----------|--------|-----------------|
| Extend AuthContext | Tinggi | ⏳ | 1-2 |
| Update AppLayout | Tinggi | ⏳ | 1-2 |
| Fix useFieldAccess | Tinggi | ⏳ | 1-2 |
| Refactor UsersManagement | Tinggi | ⏳ | 2-3 |
| Split AppSettings | Sedang | ⏳ | 2-3 |
| Update DataEntryForm | Sedang | ⏳ | 2-3 |
| Update GroupDetail | Sedang | ⏳ | 1-2 |
| Owner Billing Pages | Rendah | ⏳ | 2-3 |
| Documentation | Sedang | ⏳ | 1-2 |
| Testing | Tinggi | ⏳ | 2-3 |
| **Total** | | | **17-25 jam** |

---

## Notes

- Semua perubahan harus maintain backward compatibility
- Test di setiap tahap
- Commit frequently dengan pesan yang jelas
- Update types.ts jika ada perubahan schema
