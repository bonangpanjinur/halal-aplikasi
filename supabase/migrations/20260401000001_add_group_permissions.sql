-- Migration: Add Group Permissions
-- Purpose: Manage granular permissions for group members (e.g., who can add data)
-- Date: 2026-04-01

-- 1. Create permission type enum
CREATE TYPE public.group_permission AS ENUM (
  'can_view_data',
  'can_add_data',
  'can_edit_data',
  'can_delete_data',
  'can_manage_members'
);

-- 2. Create group_member_permissions table
CREATE TABLE public.group_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission group_permission NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE (group_id, user_id, permission)
);

ALTER TABLE public.group_member_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Create helper function to check if user has permission in group
CREATE OR REPLACE FUNCTION public.has_group_permission(_user_id UUID, _group_id UUID, _permission group_permission)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Super admin always has all permissions
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- Group owner always has all permissions
  IF EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = _user_id) THEN
    RETURN TRUE;
  END IF;

  -- Check explicit permission
  RETURN EXISTS (
    SELECT 1 FROM public.group_member_permissions
    WHERE group_id = _group_id AND user_id = _user_id AND permission = _permission
  );
END;
$$;

-- 4. Create helper function to get all permissions for a user in a group
CREATE OR REPLACE FUNCTION public.get_group_permissions(_user_id UUID, _group_id UUID)
RETURNS SETOF group_permission LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Super admin has all permissions
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') THEN
    RETURN QUERY SELECT CAST(unnest(enum_range(NULL::group_permission)) AS group_permission);
    RETURN;
  END IF;

  -- Group owner has all permissions
  IF EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = _user_id) THEN
    RETURN QUERY SELECT CAST(unnest(enum_range(NULL::group_permission)) AS group_permission);
    RETURN;
  END IF;

  -- Return explicit permissions
  RETURN QUERY
  SELECT permission FROM public.group_member_permissions
  WHERE group_id = _group_id AND user_id = _user_id;
END;
$$;

-- 5. RLS Policies for group_member_permissions
CREATE POLICY "admin_all_permissions" ON public.group_member_permissions FOR ALL 
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "owner_manage_permissions" ON public.group_member_permissions FOR ALL 
USING (public.is_group_owner(auth.uid(), group_id)) 
WITH CHECK (public.is_group_owner(auth.uid(), group_id));

CREATE POLICY "user_view_own_permissions" ON public.group_member_permissions FOR SELECT 
USING (user_id = auth.uid());

-- 6. Create function to auto-grant default permissions when member is added
CREATE OR REPLACE FUNCTION public.grant_default_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Grant default permissions to new group member
  INSERT INTO public.group_member_permissions (group_id, user_id, permission, granted_by)
  VALUES 
    (NEW.group_id, NEW.user_id, 'can_view_data', NULL),
    (NEW.group_id, NEW.user_id, 'can_add_data', NULL)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 7. Create trigger to auto-grant permissions when member is added
CREATE TRIGGER grant_permissions_on_member_add
AFTER INSERT ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.grant_default_permissions();

-- 8. Update data_entries RLS policies to use new permission system
DO $$ 
BEGIN
    EXECUTE (
        SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.data_entries;', ' '), 'SELECT 1;')
        FROM pg_policies WHERE tablename = 'data_entries' AND schemaname = 'public'
    );
END $$;

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

-- Group members with can_view_data permission can view entries
CREATE POLICY "member_view_group_entries" ON public.data_entries FOR SELECT 
USING (public.has_group_permission(auth.uid(), group_id, 'can_view_data'::group_permission));

-- Group members with can_add_data permission can insert entries
CREATE POLICY "member_insert_group_entries" ON public.data_entries FOR INSERT 
WITH CHECK (public.has_group_permission(auth.uid(), group_id, 'can_add_data'::group_permission));

-- Group members with can_edit_data permission can update entries
CREATE POLICY "member_update_group_entries" ON public.data_entries FOR UPDATE 
USING (public.has_group_permission(auth.uid(), group_id, 'can_edit_data'::group_permission));

-- Group members with can_delete_data permission can delete entries
CREATE POLICY "member_delete_group_entries" ON public.data_entries FOR DELETE 
USING (public.has_group_permission(auth.uid(), group_id, 'can_delete_data'::group_permission));
