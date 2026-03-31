-- RLS MASTER FIX V2: Resolving ALL Infinite Recursion and 500 Errors
-- This script cleans up RLS on profiles, user_roles, groups, group_members, and data_entries.
-- Run this in your Supabase SQL Editor.

-- 1. Create robust SECURITY DEFINER functions to break ALL recursion
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = _user_id);
END;
$$;

-- 2. Cleanup all previous policies on ALL problematic tables
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['profiles', 'user_roles', 'groups', 'group_members', 'data_entries'])
    LOOP
        EXECUTE (
            SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.' || quote_ident(t) || ';', ' '), 'SELECT 1;')
            FROM pg_policies WHERE tablename = t AND schemaname = 'public'
        );
    END LOOP;
END $$;

-- 3. USER_ROLES Policies
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_user_roles" ON public.user_roles FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "user_view_own_role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owner_view_managed_roles" ON public.user_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.owner_id = auth.uid())
);

-- 4. PROFILES Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_profiles" ON public.profiles FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "user_manage_own_profile" ON public.profiles FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "owner_manage_direct_profiles" ON public.profiles FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Allow profile creation on signup" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. GROUPS Policies
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_groups" ON public.groups FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "owner_manage_groups" ON public.groups FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "member_view_groups" ON public.groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid())
);

-- 6. GROUP_MEMBERS Policies (THE MAIN SOURCE OF RECURSION)
-- We avoid any joins back to profiles or user_roles inside the USING clause.
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_group_members" ON public.group_members FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "user_view_own_membership" ON public.group_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owner_manage_group_members" ON public.group_members FOR ALL USING (
  public.is_group_owner(auth.uid(), group_id)
) WITH CHECK (
  public.is_group_owner(auth.uid(), group_id)
);

-- 7. DATA_ENTRIES Policies
ALTER TABLE public.data_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_data_entries" ON public.data_entries FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "user_manage_own_entries" ON public.data_entries FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner_view_group_entries" ON public.data_entries FOR SELECT USING (
  public.is_group_owner(auth.uid(), group_id)
);
