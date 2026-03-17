-- Payment Methods Management for Owners

-- 1. Create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  account_name TEXT,
  account_number TEXT,
  bank_code TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Create owner_payment_methods junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.owner_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, payment_method_id)
);

-- 3. Add payment_method_id to owner_invoices for tracking which method was used
ALTER TABLE public.owner_invoices 
ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_payment_methods ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for payment_methods
DROP POLICY IF EXISTS "Super admin can manage payment methods" ON public.payment_methods;
CREATE POLICY "Super admin can manage payment methods"
ON public.payment_methods FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Owners can view active payment methods" ON public.payment_methods;
CREATE POLICY "Owners can view active payment methods"
ON public.payment_methods FOR SELECT
TO authenticated
USING (is_active = true);

-- 6. RLS Policies for owner_payment_methods
DROP POLICY IF EXISTS "Super admin can manage owner payment methods" ON public.owner_payment_methods;
CREATE POLICY "Super admin can manage owner payment methods"
ON public.owner_payment_methods FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Owners can view their payment methods" ON public.owner_payment_methods;
CREATE POLICY "Owners can view their payment methods"
ON public.owner_payment_methods FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- 7. Insert default payment methods
INSERT INTO public.payment_methods (name, description, account_name, account_number, bank_code, display_order)
VALUES 
  ('Bank Transfer - BCA', 'Transfer ke rekening BCA', 'PT HalalTrack', '1234567890', 'BCA', 1),
  ('Bank Transfer - Mandiri', 'Transfer ke rekening Mandiri', 'PT HalalTrack', '1234567890', 'MANDIRI', 2),
  ('Bank Transfer - BNI', 'Transfer ke rekening BNI', 'PT HalalTrack', '1234567890', 'BNI', 3),
  ('E-Wallet - GCash', 'Pembayaran via GCash', 'HalalTrack', '+63XXXXXXXXX', 'GCASH', 4),
  ('E-Wallet - OVO', 'Pembayaran via OVO', 'HalalTrack', '+62XXXXXXXXX', 'OVO', 5)
ON CONFLICT DO NOTHING;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_owner_payment_methods_owner_id ON public.owner_payment_methods(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_payment_methods_preferred ON public.owner_payment_methods(owner_id, is_preferred);
CREATE INDEX IF NOT EXISTS idx_owner_invoices_payment_method_id ON public.owner_invoices(payment_method_id);
