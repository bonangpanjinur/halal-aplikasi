-- Phase 5: Multi-Owner Billing and Tiered Settings

-- 1. Create billing_plans table
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL DEFAULT 0,
  fee_per_certificate INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default plans
INSERT INTO public.billing_plans (name, description, base_price, fee_per_certificate)
VALUES 
  ('Starter', 'Cocok untuk perorangan atau bisnis kecil', 0, 25000),
  ('Professional', 'Untuk bisnis berkembang dengan volume menengah', 500000, 15000),
  ('Enterprise', 'Untuk organisasi besar dengan volume tinggi', 2000000, 5000)
ON CONFLICT DO NOTHING;

-- 2. Create subscriptions table to track which owner is on which plan
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

-- 3. Add subscription_id to owner_invoices for better tracking
ALTER TABLE public.owner_invoices 
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS base_amount INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_amount INTEGER NOT NULL DEFAULT 0;

-- 4. Enable RLS
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- billing_plans
DROP POLICY IF EXISTS "Anyone can view active billing plans" ON public.billing_plans;
CREATE POLICY "Anyone can view active billing plans"
ON public.billing_plans FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Super admin can manage billing plans" ON public.billing_plans;
CREATE POLICY "Super admin can manage billing plans"
ON public.billing_plans FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- subscriptions
DROP POLICY IF EXISTS "Super admin can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Super admin can manage subscriptions"
ON public.subscriptions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Owners can view own subscription" ON public.subscriptions;
CREATE POLICY "Owners can view own subscription"
ON public.subscriptions FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- 6. Functions for automated billing (Optional/Future use)
-- This function would be called by a cron job or manually by super admin
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(target_period TEXT)
RETURNS INTEGER AS $$
DECLARE
    owner_record RECORD;
    invoice_count INTEGER := 0;
    v_plan_id UUID;
    v_base_price INTEGER;
    v_fee_per_cert INTEGER;
    v_invoice_id UUID;
    v_usage_count INTEGER;
    v_usage_amount INTEGER;
BEGIN
    FOR owner_record IN 
        SELECT p.id, p.full_name, s.plan_id, s.id as sub_id
        FROM public.profiles p
        JOIN public.user_roles ur ON p.id = ur.user_id
        LEFT JOIN public.subscriptions s ON p.id = s.owner_id
        WHERE ur.role = 'owner'
    LOOP
        -- Default to Starter if no subscription
        IF owner_record.plan_id IS NULL THEN
            SELECT id, base_price, fee_per_certificate INTO v_plan_id, v_base_price, v_fee_per_cert 
            FROM public.billing_plans WHERE name = 'Starter' LIMIT 1;
        ELSE
            SELECT id, base_price, fee_per_certificate INTO v_plan_id, v_base_price, v_fee_per_cert 
            FROM public.billing_plans WHERE id = owner_record.plan_id;
        END IF;

        -- Create invoice
        INSERT INTO public.owner_invoices (owner_id, period, status, base_amount, subscription_id)
        VALUES (owner_record.id, target_period, 'draft', v_base_price, owner_record.sub_id)
        ON CONFLICT (owner_id, period) DO UPDATE 
        SET base_amount = EXCLUDED.base_amount,
            subscription_id = EXCLUDED.subscription_id
        RETURNING id INTO v_invoice_id;

        -- Count completed certificates in this period for this owner
        -- We'll look at data_entries in groups owned by this owner that reached 'sertifikat_selesai' in this period
        -- For simplicity in this mock/initial version, we'll just count all currently 'sertifikat_selesai'
        -- that don't have an invoice item yet.
        
        WITH certs_to_bill AS (
            SELECT de.id, de.nama
            FROM public.data_entries de
            JOIN public.groups g ON de.group_id = g.id
            WHERE g.owner_id = owner_record.id
              AND de.status = 'sertifikat_selesai'
              AND NOT EXISTS (
                  SELECT 1 FROM public.owner_invoice_items oii 
                  WHERE oii.entry_id = de.id
              )
        )
        INSERT INTO public.owner_invoice_items (invoice_id, owner_id, entry_id, amount, description)
        SELECT v_invoice_id, owner_record.id, id, v_fee_per_cert, 'Biaya Sertifikat: ' || nama
        FROM certs_to_bill;

        -- Update total amount
        SELECT COALESCE(SUM(amount), 0) INTO v_usage_amount FROM public.owner_invoice_items WHERE invoice_id = v_invoice_id;
        
        UPDATE public.owner_invoices 
        SET usage_amount = v_usage_amount,
            total_amount = base_amount + v_usage_amount,
            updated_at = now()
        WHERE id = v_invoice_id;

        invoice_count := invoice_count + 1;
    END LOOP;
    
    RETURN invoice_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
