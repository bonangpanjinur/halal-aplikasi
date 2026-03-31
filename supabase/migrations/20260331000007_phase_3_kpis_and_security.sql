-- 1. Success Metrics (KPIs) Support
-- Add columns to track lifecycle timestamps for TTC calculation
ALTER TABLE public.data_entries 
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update timestamps based on status changes
CREATE OR REPLACE FUNCTION public.update_entry_lifecycle_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'siap_input' AND OLD.status = 'belum_lengkap' THEN
    NEW.ready_at = now();
  ELSIF NEW.status = 'pengajuan' AND OLD.status != 'pengajuan' THEN
    NEW.submitted_at = now();
  ELSIF NEW.status = 'sertifikat_selesai' AND OLD.status != 'sertifikat_selesai' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_entry_lifecycle ON public.data_entries;
CREATE TRIGGER tr_update_entry_lifecycle
BEFORE UPDATE ON public.data_entries
FOR EACH ROW EXECUTE FUNCTION public.update_entry_lifecycle_timestamps();

-- 2. SLA & Escalation Support
-- Add SLA configuration table
CREATE TABLE IF NOT EXISTS public.sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL UNIQUE,
  limit_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default SLA values
INSERT INTO public.sla_configs (status, limit_days)
VALUES 
  ('siap_input', 3),
  ('terverifikasi', 3),
  ('nib_selesai', 2),
  ('pengajuan', 14)
ON CONFLICT (status) DO UPDATE SET limit_days = EXCLUDED.limit_days;

-- 3. Audit Trail for Sensitive Data Access
CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entry_id UUID REFERENCES public.data_entries(id),
  access_type TEXT NOT NULL, -- 'view_ktp', 'view_nib', 'view_sertifikat', 'view_credentials'
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS for access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all access logs"
ON public.access_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Owners can view access logs for their tenant"
ON public.access_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.data_entries de ON de.id = access_logs.entry_id
    WHERE p.id = auth.uid() AND p.role = 'owner' AND de.owner_id = p.id
  )
);

-- 4. Error Logging Table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  severity TEXT NOT NULL, -- 'critical', 'major', 'minor', 'warning'
  category TEXT NOT NULL, -- 'database', 'api', 'ui', 'logic'
  message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for error_logs
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all error logs"
ON public.error_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);
