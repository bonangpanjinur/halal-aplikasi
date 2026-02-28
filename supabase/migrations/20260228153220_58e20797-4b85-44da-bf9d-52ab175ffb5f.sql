
-- Drop the existing trigger that's causing conflict
DROP TRIGGER IF EXISTS update_data_entries_updated_at ON public.data_entries;

-- Re-create it
CREATE TRIGGER update_data_entries_updated_at
  BEFORE UPDATE ON public.data_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill missing profiles from auth.users
INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  u.email,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
