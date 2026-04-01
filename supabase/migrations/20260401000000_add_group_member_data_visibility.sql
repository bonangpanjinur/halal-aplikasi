-- Migration: Add Group Member Data Visibility
-- Purpose: Allow all members of a group to see data entries within that group, regardless of role
-- Date: 2026-04-01

-- 1. Create a helper function to check if user is a member of a group
CREATE OR REPLACE FUNCTION public.is_member_of_group(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE user_id = _user_id AND group_id = _group_id
  );
END;
$$;

-- 2. Drop existing data_entries policies to replace them
DO $$ 
BEGIN
    EXECUTE (
        SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.data_entries;', ' '), 'SELECT 1;')
        FROM pg_policies WHERE tablename = 'data_entries' AND schemaname = 'public'
    );
END $$;

-- 3. Create new DATA_ENTRIES Policies with group member visibility
ALTER TABLE public.data_entries ENABLE ROW LEVEL SECURITY;

-- Super admin has full access
CREATE POLICY "admin_all_data_entries" ON public.data_entries FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- Users can manage their own entries
CREATE POLICY "user_manage_own_entries" ON public.data_entries FOR ALL 
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Group owners can view all entries in their groups
CREATE POLICY "owner_view_group_entries" ON public.data_entries FOR SELECT 
USING (public.is_group_owner(auth.uid(), group_id));

-- **KEY POLICY**: All group members can view data entries in their groups (regardless of role)
CREATE POLICY "member_view_group_entries" ON public.data_entries FOR SELECT 
USING (public.is_member_of_group(auth.uid(), group_id));

-- Group members can insert entries into their groups
CREATE POLICY "member_insert_group_entries" ON public.data_entries FOR INSERT 
WITH CHECK (public.is_member_of_group(auth.uid(), group_id));

-- Group members can update entries in their groups
CREATE POLICY "member_update_group_entries" ON public.data_entries FOR UPDATE 
USING (public.is_member_of_group(auth.uid(), group_id));

-- Group members can delete entries in their groups
CREATE POLICY "member_delete_group_entries" ON public.data_entries FOR DELETE 
USING (public.is_member_of_group(auth.uid(), group_id));

-- 4. Ensure is_super_admin function exists
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
END;
$$;

-- 5. Ensure is_group_owner function exists
CREATE OR REPLACE FUNCTION public.is_group_owner(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = _user_id);
END;
$$;

-- 6. Update GROUP_MEMBERS Policies to ensure group members can view each other
DO $$ 
BEGIN
    EXECUTE (
        SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.group_members;', ' '), 'SELECT 1;')
        FROM pg_policies WHERE tablename = 'group_members' AND schemaname = 'public'
    );
END $$;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all group members
CREATE POLICY "admin_all_group_members" ON public.group_members FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- Users can view their own membership
CREATE POLICY "user_view_own_membership" ON public.group_members FOR SELECT 
USING (user_id = auth.uid());

-- Group owners can manage group members
CREATE POLICY "owner_manage_group_members" ON public.group_members FOR ALL 
USING (public.is_group_owner(auth.uid(), group_id)) 
WITH CHECK (public.is_group_owner(auth.uid(), group_id));

-- **KEY POLICY**: Group members can view other members in their group
CREATE POLICY "member_view_group_members" ON public.group_members FOR SELECT 
USING (public.is_member_of_group(auth.uid(), group_id));

-- 7. Update GROUPS Policies to ensure consistency
DO $$ 
BEGIN
    EXECUTE (
        SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.groups;', ' '), 'SELECT 1;')
        FROM pg_policies WHERE tablename = 'groups' AND schemaname = 'public'
    );
END $$;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all groups
CREATE POLICY "admin_all_groups" ON public.groups FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- Group owners can manage their groups
CREATE POLICY "owner_manage_groups" ON public.groups FOR ALL 
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- **KEY POLICY**: Group members can view their groups
CREATE POLICY "member_view_groups" ON public.groups FOR SELECT 
USING (public.is_member_of_group(auth.uid(), id));
