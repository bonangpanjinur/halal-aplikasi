-- 1. Ensure owner_id column exists in profiles table with proper reference
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON public.profiles(owner_id);

-- 3. Update RLS policies for profiles to reflect owner-member relationship
-- This ensures that an owner can only see and manage their own members

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Owners can view their members" ON public.profiles;
DROP POLICY IF EXISTS "Owners can update their members" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Super admin can manage all profiles
CREATE POLICY "Super admin can manage all profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Users can always view and update their own profile
CREATE POLICY "Users can manage own profile"
ON public.profiles
FOR ALL
USING (id = auth.uid());

-- Owners can view and update profiles of users linked to them
CREATE POLICY "Owners can manage their members"
ON public.profiles
FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 4. Update RLS policies for user_roles to reflect owner-member relationship
-- This ensures that an owner can only see and manage roles of their own members

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Owners can view their members roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

-- Super admin can manage all roles
CREATE POLICY "Super admin can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Users can view their own role
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Owners can view roles of users linked to them
CREATE POLICY "Owners can view their members roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = user_roles.user_id
    AND profiles.owner_id = auth.uid()
  )
);

-- 5. Ensure groups are strictly isolated by owner_id
-- This was partially done in the previous migration, but let's reinforce it

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Owners can manage own groups" ON public.groups;

-- Owners can manage ONLY their own groups
CREATE POLICY "Owners can manage own groups"
ON public.groups
FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 6. Ensure data_entries are strictly isolated by owner_id
-- This ensures that an owner can only see and manage data entries of their own groups

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Owners can manage own group entries" ON public.data_entries;

-- Owners can manage entries of groups they own
CREATE POLICY "Owners can manage own group entries"
ON public.data_entries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.groups
    WHERE groups.id = data_entries.group_id
    AND groups.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups
    WHERE groups.id = data_entries.group_id
    AND groups.owner_id = auth.uid()
  )
);
