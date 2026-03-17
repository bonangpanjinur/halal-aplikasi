-- Phase 3: Update entry_status enum and data_entries table

-- 1. Add new status to entry_status enum
-- Note: In Supabase/PostgreSQL, we can't add enum values in a transaction. 
-- For a real Supabase project, we would run these separately.
-- But for the migration script:
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'revisi';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'selesai_revisi';

-- 2. Add new fields to data_entries
ALTER TABLE public.data_entries 
ADD COLUMN IF NOT EXISTS email_halal TEXT,
ADD COLUMN IF NOT EXISTS sandi_halal TEXT,
ADD COLUMN IF NOT EXISTS email_nib TEXT,
ADD COLUMN IF NOT EXISTS sandi_nib TEXT;

-- 3. Update field_access for new fields for relevant roles
-- Roles: admin, lapangan, nib, admin_input
INSERT INTO public.field_access (role, field_name, can_view, can_edit)
SELECT r.role, f.field, true, true
FROM 
  (SELECT unnest(ARRAY['admin', 'lapangan', 'nib', 'admin_input']::public.app_role[]) as role) r,
  (SELECT unnest(ARRAY['email_halal', 'sandi_halal', 'email_nib', 'sandi_nib']) as field) f
ON CONFLICT (role, field_name) DO NOTHING;

-- 4. Add new status permissions to field_access
INSERT INTO public.field_access (role, field_name, can_view, can_edit)
SELECT r.role, f.field, true, true
FROM 
  (SELECT unnest(ARRAY['admin', 'owner', 'admin_input']::public.app_role[]) as role) r,
  (SELECT unnest(ARRAY['status:revisi', 'status:selesai_revisi']) as field) f
ON CONFLICT (role, field_name) DO NOTHING;
