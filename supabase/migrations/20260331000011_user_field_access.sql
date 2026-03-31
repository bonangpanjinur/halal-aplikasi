-- Create user_field_access table for per-user field access overrides
CREATE TABLE IF NOT EXISTS public.user_field_access (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    field_name text NOT NULL,
    can_view boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, field_name)
);

-- Enable RLS
ALTER TABLE public.user_field_access ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Super admin can do everything
CREATE POLICY "Super admins can manage all user field access"
ON public.user_field_access
FOR ALL
USING (
    (get_user_role(auth.uid()) = 'super_admin')
)
WITH CHECK (
    (get_user_role(auth.uid()) = 'super_admin')
);

-- 2. Owners can manage their members' field access
CREATE POLICY "Owners can manage their members' field access"
ON public.user_field_access
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = public.user_field_access.user_id AND owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = public.user_field_access.user_id AND owner_id = auth.uid()
    )
);

-- 3. Users can view their own field access
CREATE POLICY "Users can view their own field access"
ON public.user_field_access
FOR SELECT
USING (user_id = auth.uid());

-- Grant access to authenticated users
GRANT ALL ON public.user_field_access TO authenticated;
GRANT ALL ON public.user_field_access TO service_role;
