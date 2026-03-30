-- Function to validate that non-owner/non-super_admin users have an owner_id
CREATE OR REPLACE FUNCTION public.validate_role_owner_relationship()
RETURNS TRIGGER AS $$
DECLARE
    curr_role public.app_role;
    curr_owner_id UUID;
    target_user_id UUID;
BEGIN
    -- Determine which user we are checking
    IF TG_TABLE_NAME = 'profiles' THEN
        target_user_id := NEW.id;
        curr_owner_id := NEW.owner_id;
        SELECT role INTO curr_role FROM public.user_roles WHERE user_id = target_user_id;
    ELSIF TG_TABLE_NAME = 'user_roles' THEN
        target_user_id := NEW.user_id;
        curr_role := NEW.role;
        SELECT owner_id INTO curr_owner_id FROM public.profiles WHERE id = target_user_id;
    END IF;

    -- If role is not set yet (e.g. during initial profile creation before role is assigned), we skip
    -- The user_roles trigger will catch it when the role is assigned.
    IF curr_role IS NULL THEN
        RETURN NEW;
    END IF;

    -- Requirement: Every role except owner and super admin must have an owner
    IF curr_role NOT IN ('super_admin', 'owner') AND curr_owner_id IS NULL THEN
        RAISE EXCEPTION 'User with role % must have an owner assigned.', curr_role;
    END IF;

    -- Additional check: owners should generally be their own owner or have no owner_id
    -- But the requirement specifically says "except owner and super admin"
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles table
DROP TRIGGER IF EXISTS tr_validate_profile_owner ON public.profiles;
CREATE TRIGGER tr_validate_profile_owner
AFTER INSERT OR UPDATE OF owner_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_role_owner_relationship();

-- Trigger for user_roles table
DROP TRIGGER IF EXISTS tr_validate_role_owner ON public.user_roles;
CREATE TRIGGER tr_validate_role_owner
AFTER INSERT OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.validate_role_owner_relationship();
