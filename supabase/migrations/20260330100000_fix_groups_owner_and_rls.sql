-- 1. Ensure owner_id column exists in groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);

-- 3. Enable RLS (it should be enabled, but let's be sure)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Owners can manage own groups" ON public.groups;
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Super admin can manage groups" ON public.groups;

-- 5. Implement the new policies

-- Super admins can do everything
CREATE POLICY "Super admin can manage groups" 
ON public.groups 
FOR ALL 
USING (public.has_role(auth.uid(), 'super_admin'));

-- Owners can manage ONLY their own groups
-- This ensures owners cannot see or access groups of other owners
CREATE POLICY "Owners can manage own groups"
ON public.groups
FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Members can view groups they belong to (for non-owner users like agents/inputters)
CREATE POLICY "Members can view their groups" 
ON public.groups 
FOR SELECT 
USING (public.is_member_of_group(auth.uid(), id));

-- 6. Update other related tables to ensure strict owner isolation if needed
-- (Assuming other tables already have similar owner_id logic based on previous migrations)
