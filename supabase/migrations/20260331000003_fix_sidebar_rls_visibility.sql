-- Fix sidebar visibility issue by ensuring users can always read their own role and profile
-- This migration addresses the RLS policies that were preventing sidebar from rendering

-- 1. Drop all existing policies on user_roles to start fresh
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view their members roles" ON public.user_roles;

-- 2. Create comprehensive RLS policies for user_roles
-- Policy 1: Super admin has full access
CREATE POLICY "Super admin full access to user_roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Policy 2: Users can always view their own role (this is CRITICAL for sidebar)
-- This uses a simple direct comparison which is more reliable
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Policy 3: Owners can view roles of their members
CREATE POLICY "Owners can view member roles"
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

-- 3. Ensure RLS is enabled on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Drop and recreate profiles policies with better visibility
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage their members" ON public.profiles;

-- Policy 1: Super admin has full access
CREATE POLICY "Super admin full access to profiles"
ON public.profiles FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Policy 2: Users can always view and update their own profile (CRITICAL for sidebar)
CREATE POLICY "Users can manage own profile"
ON public.profiles FOR ALL
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 3: Owners can view and update profiles of their members
CREATE POLICY "Owners can manage member profiles"
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

-- 5. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
