-- Add commission settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'per_certificate' CHECK (commission_type IN ('per_certificate', 'monthly_salary')),
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_ktp INTEGER DEFAULT 130,
ADD COLUMN IF NOT EXISTS over_target_rate NUMERIC DEFAULT 25000;

-- Update RLS policies if necessary (assuming existing policies cover these columns)
-- Profiles are typically viewable by everyone in the same owner_id or by super_admin

-- Update auto_create_commission to respect commission_type
CREATE OR REPLACE FUNCTION public.auto_create_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rate integer;
  pic_role app_role;
  group_owner_id uuid;
  v_comm_type text;
BEGIN
  IF NEW.pic_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO pic_role FROM public.user_roles WHERE user_id = NEW.pic_user_id LIMIT 1;
  IF pic_role IS NULL OR pic_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO group_owner_id FROM public.groups WHERE id = NEW.group_id LIMIT 1;
  SELECT commission_type INTO v_comm_type FROM public.profiles WHERE id = NEW.pic_user_id LIMIT 1;

  -- If monthly salary, we still insert a record but with 0 amount to track the entry count
  IF v_comm_type = 'monthly_salary' THEN
    INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
    VALUES (NEW.pic_user_id, NEW.id, NEW.group_id, 0, to_char(now(), 'YYYY-MM'));
    RETURN NEW;
  END IF;

  SELECT amount_per_entry INTO rate
  FROM public.commission_rates
  WHERE role = pic_role
    AND owner_id IS NOT DISTINCT FROM group_owner_id
  LIMIT 1;

  IF rate IS NOT NULL AND rate > 0 THEN
    INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
    VALUES (NEW.pic_user_id, NEW.id, NEW.group_id, rate, to_char(now(), 'YYYY-MM'));
  END IF;

  RETURN NEW;
END;
$function$;

-- Update auto_create_commission_on_status_change to respect commission_type
CREATE OR REPLACE FUNCTION public.auto_create_commission_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changer_id uuid;
  changer_role app_role;
  rate integer;
  group_owner_id uuid;
  v_comm_type text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  changer_id := auth.uid();
  IF changer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO changer_role FROM public.user_roles WHERE user_id = changer_id LIMIT 1;
  IF changer_role IS NULL OR changer_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO group_owner_id FROM public.groups WHERE id = NEW.group_id LIMIT 1;
  SELECT commission_type INTO v_comm_type FROM public.profiles WHERE id = changer_id LIMIT 1;

  IF v_comm_type = 'monthly_salary' THEN
    INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
    VALUES (changer_id, NEW.id, NEW.group_id, 0, to_char(now(), 'YYYY-MM'))
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT amount_per_entry INTO rate
  FROM public.commission_rates
  WHERE role = changer_role
    AND owner_id IS NOT DISTINCT FROM group_owner_id
  LIMIT 1;

  IF rate IS NOT NULL AND rate > 0 THEN
    INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
    VALUES (changer_id, NEW.id, NEW.group_id, rate, to_char(now(), 'YYYY-MM'))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
