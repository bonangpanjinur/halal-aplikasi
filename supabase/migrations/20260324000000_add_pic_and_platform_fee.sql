-- Add pic_id to shared_links
ALTER TABLE public.shared_links 
ADD COLUMN pic_id uuid REFERENCES public.profiles(id);

-- Add platform_fee_per_entry to profiles
ALTER TABLE public.profiles 
ADD COLUMN platform_fee_per_entry numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.shared_links.pic_id IS 'The Person In Charge (PIC) assigned to this share link';
COMMENT ON COLUMN public.profiles.platform_fee_per_entry IS 'Custom platform fee per entry for this owner';
