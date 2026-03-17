-- Add owner scope to profiles and groups
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON public.profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);

-- Add new credential fields to data_entries
ALTER TABLE public.data_entries
ADD COLUMN IF NOT EXISTS email_halal TEXT,
ADD COLUMN IF NOT EXISTS sandi_halal TEXT,
ADD COLUMN IF NOT EXISTS email_nib TEXT,
ADD COLUMN IF NOT EXISTS sandi_nib TEXT;

-- Backfill new credential columns from legacy fields when possible
UPDATE public.data_entries
SET email_halal = COALESCE(email_halal, email),
    sandi_halal = COALESCE(sandi_halal, kata_sandi)
WHERE email IS NOT NULL OR kata_sandi IS NOT NULL;

-- Extend entry_status enum with revision statuses
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'revisi';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'selesai_revisi';

-- Scope commission rates per owner
ALTER TABLE public.commission_rates
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Remove global duplicates and normalize unique rows per owner+role
DELETE FROM public.commission_rates a
USING public.commission_rates b
WHERE a.id < b.id
  AND a.role = b.role
  AND a.owner_id IS NOT DISTINCT FROM b.owner_id;

CREATE UNIQUE INDEX IF NOT EXISTS commission_rates_owner_role_key
ON public.commission_rates(owner_id, role);

CREATE INDEX IF NOT EXISTS idx_commission_rates_owner_id ON public.commission_rates(owner_id);

-- Owner billing configuration
CREATE TABLE IF NOT EXISTS public.owner_billing_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fee_per_certificate INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE(owner_id)
);

CREATE TABLE IF NOT EXISTS public.owner_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount INTEGER NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, period)
);

CREATE INDEX IF NOT EXISTS idx_owner_invoices_owner_id ON public.owner_invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_invoices_status ON public.owner_invoices(status);

CREATE TABLE IF NOT EXISTS public.owner_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.owner_invoices(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.data_entries(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_owner_invoice_items_invoice_id ON public.owner_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_owner_invoice_items_owner_id ON public.owner_invoice_items(owner_id);

-- Enable RLS for new tables
ALTER TABLE public.owner_billing_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for owner_billing_rates
DROP POLICY IF EXISTS "Super admin can manage owner billing rates" ON public.owner_billing_rates;
CREATE POLICY "Super admin can manage owner billing rates"
ON public.owner_billing_rates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Owners can view own billing rate" ON public.owner_billing_rates;
CREATE POLICY "Owners can view own billing rate"
ON public.owner_billing_rates
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- RLS policies for owner_invoices
DROP POLICY IF EXISTS "Super admin can manage owner invoices" ON public.owner_invoices;
CREATE POLICY "Super admin can manage owner invoices"
ON public.owner_invoices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Owners can view own invoices" ON public.owner_invoices;
CREATE POLICY "Owners can view own invoices"
ON public.owner_invoices
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- RLS policies for owner_invoice_items
DROP POLICY IF EXISTS "Super admin can manage owner invoice items" ON public.owner_invoice_items;
CREATE POLICY "Super admin can manage owner invoice items"
ON public.owner_invoice_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Owners can view own invoice items" ON public.owner_invoice_items;
CREATE POLICY "Owners can view own invoice items"
ON public.owner_invoice_items
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Owner policies for existing tables
DROP POLICY IF EXISTS "Owners can view owned users" ON public.profiles;
CREATE POLICY "Owners can view owned users"
ON public.profiles
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR id = auth.uid());

DROP POLICY IF EXISTS "Owners can update owned users" ON public.profiles;
CREATE POLICY "Owners can update owned users"
ON public.profiles
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage own groups" ON public.groups;
CREATE POLICY "Owners can manage own groups"
ON public.groups
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage group members in own groups" ON public.group_members;
CREATE POLICY "Owners can manage group members in own groups"
ON public.group_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can access entries in own groups" ON public.data_entries;
CREATE POLICY "Owners can access entries in own groups"
ON public.data_entries
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = data_entries.group_id
      AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = data_entries.group_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can access entry photos in own groups" ON public.entry_photos;
CREATE POLICY "Owners can access entry photos in own groups"
ON public.entry_photos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.data_entries de
    JOIN public.groups g ON g.id = de.group_id
    WHERE de.id = entry_photos.entry_id
      AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.data_entries de
    JOIN public.groups g ON g.id = de.group_id
    WHERE de.id = entry_photos.entry_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can view audit logs in own groups" ON public.audit_logs;
CREATE POLICY "Owners can view audit logs in own groups"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = audit_logs.group_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can manage shared links in own groups" ON public.shared_links;
CREATE POLICY "Owners can manage shared links in own groups"
ON public.shared_links
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = shared_links.group_id
      AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = shared_links.group_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can view tenant commissions" ON public.commissions;
CREATE POLICY "Owners can view tenant commissions"
ON public.commissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = commissions.group_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can update tenant commissions" ON public.commissions;
CREATE POLICY "Owners can update tenant commissions"
ON public.commissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = commissions.group_id
      AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = commissions.group_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can view scoped commission rates" ON public.commission_rates;
CREATE POLICY "Owners can view scoped commission rates"
ON public.commission_rates
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage scoped commission rates" ON public.commission_rates;
CREATE POLICY "Owners can manage scoped commission rates"
ON public.commission_rates
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can view owned roles" ON public.user_roles;
CREATE POLICY "Owners can view owned roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.owner_id = auth.uid()
  )
);

-- Update helper / automation functions
CREATE OR REPLACE FUNCTION public.notify_umkm_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  status_label text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.umkm_user_id IS NOT NULL THEN
    CASE NEW.status::text
      WHEN 'belum_lengkap' THEN status_label := 'Belum Lengkap';
      WHEN 'siap_input' THEN status_label := 'Siap Input';
      WHEN 'revisi' THEN status_label := 'Revisi';
      WHEN 'selesai_revisi' THEN status_label := 'Selesai Revisi';
      WHEN 'terverifikasi' THEN status_label := 'Terverifikasi';
      WHEN 'nib_selesai' THEN status_label := 'NIB Selesai';
      WHEN 'pengajuan' THEN status_label := 'Pengajuan';
      WHEN 'sertifikat_selesai' THEN status_label := 'Sertifikat Selesai';
      WHEN 'ktp_terdaftar_nib' THEN status_label := 'KTP Terdaftar NIB';
      WHEN 'ktp_terdaftar_sertifikat' THEN status_label := 'KTP Terdaftar Sertifikat';
      ELSE status_label := NEW.status::text;
    END CASE;

    INSERT INTO public.notifications (user_id, entry_id, title, message)
    VALUES (
      NEW.umkm_user_id,
      NEW.id,
      'Status Diperbarui',
      'Status untuk "' || COALESCE(NEW.nama, 'Data UMKM') || '" berubah menjadi ' || status_label
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rate integer;
  pic_role app_role;
  group_owner_id uuid;
BEGIN
  IF NEW.pic_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO pic_role FROM public.user_roles WHERE user_id = NEW.pic_user_id LIMIT 1;
  IF pic_role IS NULL OR pic_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO group_owner_id FROM public.groups WHERE id = NEW.group_id LIMIT 1;

  SELECT amount_per_entry INTO rate
  FROM public.commission_rates
  WHERE role = pic_role
    AND owner_id IS NOT DISTINCT FROM group_owner_id
  LIMIT 1;

  IF rate IS NOT NULL AND rate > 0 THEN
    INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
    VALUES (NEW.pic_user_id, NEW.id, NEW.group_id, rate, to_char(now(), 'YYYY-MM'));
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_commission_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changer_id uuid;
  changer_role app_role;
  rate integer;
  group_owner_id uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  changer_id := auth.uid();
  IF changer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO changer_role FROM public.user_roles WHERE user_id = changer_id LIMIT 1;
  IF changer_role IS NULL OR changer_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO group_owner_id FROM public.groups WHERE id = NEW.group_id LIMIT 1;

  SELECT amount_per_entry INTO rate
  FROM public.commission_rates
  WHERE role = changer_role
    AND owner_id IS NOT DISTINCT FROM group_owner_id
  LIMIT 1;

  IF rate IS NOT NULL AND rate > 0 THEN
    INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
    VALUES (changer_id, NEW.id, NEW.group_id, rate, to_char(now(), 'YYYY-MM'))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_owner_invoice_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_rate integer;
  v_invoice_id uuid;
  v_period text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status <> 'sertifikat_selesai' THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.groups
  WHERE id = NEW.group_id
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT fee_per_certificate INTO v_rate
  FROM public.owner_billing_rates
  WHERE owner_id = v_owner_id
  LIMIT 1;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    RETURN NEW;
  END IF;

  v_period := to_char(now(), 'YYYY-MM');

  INSERT INTO public.owner_invoices (owner_id, period, status, total_amount)
  VALUES (v_owner_id, v_period, 'draft', 0)
  ON CONFLICT (owner_id, period) DO NOTHING;

  SELECT id INTO v_invoice_id
  FROM public.owner_invoices
  WHERE owner_id = v_owner_id
    AND period = v_period
  LIMIT 1;

  INSERT INTO public.owner_invoice_items (invoice_id, owner_id, entry_id, amount, description)
  VALUES (
    v_invoice_id,
    v_owner_id,
    NEW.id,
    v_rate,
    'Biaya platform per sertifikat untuk ' || COALESCE(NEW.nama, 'Data UMKM')
  )
  ON CONFLICT (owner_id, entry_id) DO NOTHING;

  UPDATE public.owner_invoices oi
  SET total_amount = COALESCE((
        SELECT SUM(amount)
        FROM public.owner_invoice_items oii
        WHERE oii.invoice_id = oi.id
      ), 0),
      updated_at = now()
  WHERE oi.id = v_invoice_id;

  RETURN NEW;
END;
$function$;