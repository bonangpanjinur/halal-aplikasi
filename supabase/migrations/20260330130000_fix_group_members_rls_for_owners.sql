-- Fix RLS policies for group_members to allow owners to manage members of their own groups
-- and ensure they can only add users who are linked to them (owner_id = auth.uid())

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Super admin can manage group members" ON public.group_members;
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Owners can manage group members in own groups" ON public.group_members;

-- 2. Super admin can manage all group members
CREATE POLICY "Super admin can manage all group members"
ON public.group_members
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 3. Members can view other members in the same group
CREATE POLICY "Members can view group members"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
  )
);

-- 4. Owners can manage members in their own groups
-- This policy allows SELECT, INSERT, UPDATE, and DELETE
-- The WITH CHECK clause ensures that for INSERT/UPDATE:
-- a) The group belongs to the owner
-- b) The user being added is either the owner themselves OR a user linked to them (owner_id = auth.uid())
CREATE POLICY "Owners can manage group members in own groups"
ON public.group_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.owner_id = auth.uid()
  )
  AND (
    -- The user being added is the owner themselves
    group_members.user_id = auth.uid()
    OR
    -- OR the user being added is linked to this owner
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = group_members.user_id
        AND p.owner_id = auth.uid()
    )
  )
);
