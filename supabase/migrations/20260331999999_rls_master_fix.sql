-- RLS MASTER FIX: Resolving Infinite Recursion and Loading Issues
-- This script consolidates and cleans up all previous RLS attempts.
-- Run this in your Supabase SQL Editor if you experience infinite loading or 500 errors.

-- 1. Create a SECURITY DEFINER function to break recursion
-- This function runs with the privileges of the creator (postgres), 
-- effectively bypassing RLS for its internal query.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
END;
$$;

-- 2. Cleanup all previous policies on critical tables
DO $$ 
BEGIN
    -- Drop all policies from user_roles
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.user_roles;', ' ')
        FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
    );
    
    -- Drop all policies from profiles
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.profiles;', ' ')
        FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    );
END $$;

-- 3. Re-apply CLEAN policies for user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "admin_all_user_roles" ON public.user_roles
FOR ALL USING (public.is_super_admin(auth.uid()));

-- Users can always see their own role (Critical for App startup)
CREATE POLICY "user_view_own_role" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

-- Owners can see roles of people they manage
CREATE POLICY "owner_view_managed_roles" ON public.user_roles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id AND p.owner_id = auth.uid()
  )
);

-- 4. Re-apply CLEAN policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "admin_all_profiles" ON public.profiles
FOR ALL USING (public.is_super_admin(auth.uid()));

-- Users can manage their own profile
CREATE POLICY "user_manage_own_profile" ON public.profiles
FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Owners can manage profiles they own directly
CREATE POLICY "owner_manage_direct_profiles" ON public.profiles
FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Owners can see profiles in their groups (Broken into simple EXISTS to avoid complex joins)
CREATE POLICY "owner_view_group_profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE gm.user_id = profiles.id AND g.owner_id = auth.uid()
  )
);

-- 5. Fix groups and group_members to ensure no recursion back to profiles/roles
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_all_groups" ON public.groups;
DROP POLICY IF EXISTS "owner_manage_own_groups" ON public.groups;

CREATE POLICY "admin_all_groups" ON public.groups
FOR ALL USING (public.is_super_admin(auth.uid()));

CREATE POLICY "owner_manage_groups" ON public.groups
FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Final check: Ensure the auth.users() link is healthy by allowing profiles to be created on signup
DROP POLICY IF EXISTS "Allow profile creation on signup" ON public.profiles;
CREATE POLICY "Allow profile creation on signup" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);
