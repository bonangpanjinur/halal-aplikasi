-- Fix RLS policies to prevent recursion and ensure correct access

-- Drop existing policies that might be causing recursion
DROP POLICY IF EXISTS "owner_view_managed_roles" ON public.user_roles;
DROP POLICY IF EXISTS "owner_view_member_roles" ON public.user_roles;
DROP POLICY IF EXISTS "owner_manage_direct_profiles" ON public.profiles;
DROP POLICY IF EXISTS "owner_manage_member_profiles" ON public.profiles;
DROP POLICY IF EXISTS "member_view_groups" ON public.groups;
DROP POLICY IF EXISTS "owner_view_group_entries" ON public.data_entries;

-- Recreate policies using JWT claims or simplified security definer functions

-- USER_ROLES Policies
-- Policy: Owners can view roles of their members (simplified to avoid complex joins in RLS)
-- Assuming owner_id is available in profiles table and can be checked directly
CREATE POLICY "owner_view_member_roles" ON public.user_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.owner_id = auth.uid())
);

-- PROFILES Policies
-- Policy: Owners can manage member profiles (simplified to avoid complex joins in RLS)
CREATE POLICY "owner_manage_member_profiles" ON public.profiles FOR ALL USING (
  owner_id = auth.uid()
) WITH CHECK (
  owner_id = auth.uid()
);

-- GROUPS Policies
-- Policy: Members can view groups they belong to (simplified to avoid complex joins in RLS)
CREATE POLICY "member_view_groups" ON public.groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid())
);

-- DATA_ENTRIES Policies
-- Policy: Owner view group entries (simplified to avoid complex joins in RLS)
CREATE POLICY "owner_view_group_entries" ON public.data_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = data_entries.group_id AND g.owner_id = auth.uid())
);
