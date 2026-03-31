-- Fix RLS recursion and visibility issues
-- This migration replaces the problematic policies that caused 500 errors (infinite recursion)

-- 1. Fix profiles RLS policy
-- We use a direct join on groups table instead of group_members to avoid recursion
-- since groups table policy is simple (owner_id = auth.uid())
DROP POLICY IF EXISTS "Owners can manage their members" ON public.profiles;

CREATE POLICY "Owners can manage their members"
ON public.profiles
FOR ALL
USING (
  -- Case A: User is directly linked to the owner
  owner_id = auth.uid()
  OR 
  -- Case B: User is a member of a group owned by the owner
  -- We query group_members but filter by groups owned by auth.uid()
  -- This is safe because groups policy doesn't depend on profiles
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.user_id = profiles.id
      AND gm.group_id IN (SELECT id FROM public.groups WHERE owner_id = auth.uid())
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.user_id = profiles.id
      AND gm.group_id IN (SELECT id FROM public.groups WHERE owner_id = auth.uid())
  )
);

-- 2. Fix user_roles RLS policy
DROP POLICY IF EXISTS "Owners can view their members roles" ON public.user_roles;

CREATE POLICY "Owners can view their members roles"
ON public.user_roles
FOR SELECT
USING (
  -- Case A: User's profile is linked to the owner
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.owner_id = auth.uid()
  )
  OR 
  -- Case B: User is a member of a group owned by the owner
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.user_id = user_roles.user_id
      AND gm.group_id IN (SELECT id FROM public.groups WHERE owner_id = auth.uid())
  )
);
