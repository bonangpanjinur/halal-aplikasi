-- Quick Fix: Add pic_id column to shared_links table
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Add pic_id to shared_links
ALTER TABLE public.shared_links 
ADD COLUMN pic_id uuid REFERENCES public.profiles(id);

-- Step 2: Add platform_fee_per_entry to profiles
ALTER TABLE public.profiles 
ADD COLUMN platform_fee_per_entry numeric DEFAULT 0;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN public.shared_links.pic_id IS 'The Person In Charge (PIC) assigned to this share link';
COMMENT ON COLUMN public.profiles.platform_fee_per_entry IS 'Custom platform fee per entry for this owner';

-- Step 4: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the columns were created
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'shared_links' 
ORDER BY ordinal_position;
