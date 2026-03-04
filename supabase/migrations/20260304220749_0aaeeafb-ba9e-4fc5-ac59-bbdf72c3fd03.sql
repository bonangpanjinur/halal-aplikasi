
-- Add umkm_user_id to data_entries to link UMKM accounts
ALTER TABLE public.data_entries ADD COLUMN IF NOT EXISTS umkm_user_id uuid;

-- RLS: UMKM users can view their own entries
CREATE POLICY "UMKM can view own entries"
ON public.data_entries
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'umkm'::app_role) AND umkm_user_id = auth.uid());

-- RLS: UMKM users can view own role
-- (already covered by existing "Users can view own role" policy)

-- RLS: UMKM can view own profile (already covered by existing policies)
