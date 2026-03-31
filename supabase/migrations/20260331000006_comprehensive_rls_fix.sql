-- Comprehensive fix for RLS infinite recursion and visibility issues
-- This migration consolidates and fixes all issues from the last 6 RLS updates.
-- It ensures:
-- 1. No infinite recursion (using SECURITY DEFINER functions for role checks)
-- 2. Users can always see their own profile and role (fixes blank screen/sidebar)
-- 3. Owners can see and manage their members (profiles and roles)
-- 4. Super admins have full access

-- 1. Ensure the non-recursive role check function exists and is robust
CREATE OR REPLACE FUNCTION public.check_user_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 2. Fix user_roles table policies
-- First, drop all potentially conflicting policies from recent migrations
DROP POLICY IF EXISTS "admin_manage_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_view_own_role" ON public.user_roles;
DROP POLICY IF EXISTS "owner_view_member_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin full access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view member roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view their members roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

-- Policy: Super admin has full access
CREATE POLICY "admin_manage_all_roles"
ON public.user_roles FOR ALL
USING (public.check_user_role(auth.uid(), 'super_admin'));

-- Policy: Users can always view their own role (CRITICAL for sidebar/auth)
CREATE POLICY "user_view_own_role"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Policy: Owners can view roles of their members
CREATE POLICY "owner_view_member_roles"
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

-- 3. Fix profiles table policies
-- First, drop all potentially conflicting policies from recent migrations
DROP POLICY IF EXISTS "admin_manage_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "user_manage_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "owner_manage_member_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage their members" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Policy: Super admin has full access
CREATE POLICY "admin_manage_all_profiles"
ON public.profiles FOR ALL
USING (public.check_user_role(auth.uid(), 'super_admin'));

-- Policy: Users can manage own profile (CRITICAL for sidebar/auth)
CREATE POLICY "user_manage_own_profile"
ON public.profiles FOR ALL
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy: Owners can manage member profiles
CREATE POLICY "owner_manage_member_profiles"
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

-- 4. Fix groups table policies
-- First, drop all potentially conflicting policies from recent migrations
DROP POLICY IF EXISTS "admin_manage_all_groups" ON public.groups;
DROP POLICY IF EXISTS "owner_manage_own_groups" ON public.groups;
DROP POLICY IF EXISTS "member_view_groups" ON public.groups;
DROP POLICY IF EXISTS "Super admin can manage all groups" ON public.groups;
DROP POLICY IF EXISTS "Owners can manage their groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

-- Policy: Super admin has full access
CREATE POLICY "admin_manage_all_groups"
ON public.groups FOR ALL
USING (public.check_user_role(auth.uid(), 'super_admin'));

-- Policy: Owners can manage their groups
CREATE POLICY "owner_manage_own_groups"
ON public.groups FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Policy: Members can view groups they belong to
CREATE POLICY "member_view_groups"
ON public.groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = groups.id AND user_id = auth.uid()
  )
);

-- 5. Fix group_members table policies
-- Ensure owners can manage members in their groups
DROP POLICY IF EXISTS "admin_manage_all_group_members" ON public.group_members;
DROP POLICY IF EXISTS "owner_manage_group_members" ON public.group_members;
DROP POLICY IF EXISTS "user_view_own_group_membership" ON public.group_members;

-- Policy: Super admin has full access
CREATE POLICY "admin_manage_all_group_members"
ON public.group_members FOR ALL
USING (public.check_user_role(auth.uid(), 'super_admin'));

-- Policy: Owners can manage members in their groups
CREATE POLICY "owner_manage_group_members"
ON public.group_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_members.group_id AND owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_members.group_id AND owner_id = auth.uid()
  )
);

-- Policy: Users can view their own group memberships
CREATE POLICY "user_view_own_group_membership"
ON public.group_members FOR SELECT
USING (user_id = auth.uid());
