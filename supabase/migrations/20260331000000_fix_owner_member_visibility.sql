-- Fix owner visibility for group members
-- Allow owners to see profiles and user_roles of members in their groups,
-- not just members linked via owner_id

-- 1. Update profiles RLS policy to allow owners to see members of their groups
DROP POLICY IF EXISTS "Owners can manage their members" ON public.profiles;

-- Owners can view and update profiles of:
-- a) Users linked to them (owner_id = auth.uid())
-- b) Users who are members of groups owned by them
CREATE POLICY "Owners can manage their members"
ON public.profiles
FOR ALL
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

-- 2. Update user_roles RLS policy to allow owners to see roles of members in their groups
DROP POLICY IF EXISTS "Owners can view their members roles" ON public.user_roles;

-- Owners can view roles of:
-- a) Users linked to them (via profiles.owner_id = auth.uid())
-- b) Users who are members of groups owned by them
CREATE POLICY "Owners can view their members roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = user_roles.user_id
      AND profiles.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE gm.user_id = user_roles.user_id
      AND g.owner_id = auth.uid()
  )
);
