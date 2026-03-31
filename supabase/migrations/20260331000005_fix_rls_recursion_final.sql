-- Final fix for RLS infinite recursion and visibility issues
-- This migration addresses the root cause: public.has_role() querying user_roles table
-- which in turn has policies that call public.has_role().

-- 1. Create a non-recursive role check function
-- This function bypasses RLS by using SECURITY DEFINER and a direct query
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

-- 2. Update user_roles policies to use the non-recursive check
DROP POLICY IF EXISTS "Super admin full access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view member roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view their members roles" ON public.user_roles;

-- Policy: Super admin has full access (using non-recursive check)
CREATE POLICY "admin_manage_all_roles"
ON public.user_roles FOR ALL
USING (public.check_user_role(auth.uid(), 'super_admin'));

-- Policy: Users can always view their own role (direct check, no recursion)
CREATE POLICY "user_view_own_role"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Policy: Owners can view roles of their members (direct check on profiles/groups)
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

-- 3. Update profiles policies to use the non-recursive check
DROP POLICY IF EXISTS "Super admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage their members" ON public.profiles;

-- Policy: Super admin has full access
CREATE POLICY "admin_manage_all_profiles"
ON public.profiles FOR ALL
USING (public.check_user_role(auth.uid(), 'super_admin'));

-- Policy: Users can manage own profile
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

-- 4. Fix groups table RLS to ensure owners and admins have access
DROP POLICY IF EXISTS "Super admin can manage all groups" ON public.groups;
DROP POLICY IF EXISTS "Owners can manage their groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

CREATE POLICY "admin_manage_all_groups"
ON public.groups FOR ALL
USING (public.check_user_role(auth.uid(), 'super_admin'));

CREATE POLICY "owner_manage_own_groups"
ON public.groups FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "member_view_groups"
ON public.groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = groups.id AND user_id = auth.uid()
  )
);
