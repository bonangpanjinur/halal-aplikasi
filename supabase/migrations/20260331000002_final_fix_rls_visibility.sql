-- Final fix for RLS visibility and recursion issues
-- This migration ensures:
-- 1. Users can always see their own profile and role (crucial for sidebar)
-- 2. Owners can see profiles and roles of their members without causing recursion
-- 3. Super admins have full access

-- 1. Fix profiles RLS policies
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage their members" ON public.profiles;

-- Super admin: Full access
CREATE POLICY "Super admin can manage all profiles"
ON public.profiles FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Users: Can always view and update their own profile
CREATE POLICY "Users can manage own profile"
ON public.profiles FOR ALL
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Owners: Can view and update profiles of their members
-- We use a non-recursive check by looking at groups owned by the user
CREATE POLICY "Owners can manage their members"
ON public.profiles FOR ALL
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE gm.user_id = profiles.id
      AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE gm.user_id = profiles.id
      AND g.owner_id = auth.uid()
  )
);

-- 2. Fix user_roles RLS policies
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view their members roles" ON public.user_roles;

-- Super admin: Full access
CREATE POLICY "Super admin can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Users: Can always view their own role
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Owners: Can view roles of their members
CREATE POLICY "Owners can view their members roles"
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE gm.user_id = user_roles.user_id
      AND g.owner_id = auth.uid()
  )
);
