-- This migration ensures that all authenticated users can read their own user_roles and profiles, which is critical for the sidebar to function correctly.

-- Drop existing SELECT policies on user_roles and profiles to avoid conflicts
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;

-- Recreate policies with a clear and direct check for self-access
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT
USING (auth.uid() = id);
