-- Phase 6: Workflow Configuration Feature
-- Allows super admin to define custom workflow stages per category

-- Create workflow_categories table
CREATE TABLE IF NOT EXISTS public.workflow_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create workflow_stages table
CREATE TABLE IF NOT EXISTS public.workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.workflow_categories(id) ON DELETE CASCADE,
  stage_name VARCHAR(255) NOT NULL,
  stage_order INT NOT NULL,
  description TEXT,
  required_fields TEXT[], -- JSON array of field names required for this stage
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique stage order per category
  UNIQUE(category_id, stage_order)
);

-- Create workflow_transitions table (defines allowed transitions between stages)
CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.workflow_categories(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  allowed_roles TEXT[] DEFAULT ARRAY['super_admin'::TEXT], -- Roles that can make this transition
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique transitions
  UNIQUE(from_stage_id, to_stage_id)
);

-- Create workflow_assignments table (assigns data entries to workflow categories)
CREATE TABLE IF NOT EXISTS public.workflow_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.data_entries(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.workflow_categories(id),
  current_stage_id UUID REFERENCES public.workflow_stages(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  UNIQUE(entry_id, category_id)
);

-- Create workflow_history table (audit trail for workflow changes)
CREATE TABLE IF NOT EXISTS public.workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.data_entries(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.workflow_categories(id),
  from_stage_id UUID REFERENCES public.workflow_stages(id),
  to_stage_id UUID REFERENCES public.workflow_stages(id),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Enable RLS on all workflow tables
ALTER TABLE public.workflow_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_categories
CREATE POLICY "super_admin_all_categories" ON public.workflow_categories
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_read_categories" ON public.workflow_categories
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'owner'));

-- RLS Policies for workflow_stages
CREATE POLICY "super_admin_all_stages" ON public.workflow_stages
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_read_stages" ON public.workflow_stages
  FOR SELECT USING (
    category_id IN (SELECT id FROM public.workflow_categories WHERE is_active = true)
  );

-- RLS Policies for workflow_transitions
CREATE POLICY "super_admin_all_transitions" ON public.workflow_transitions
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_read_transitions" ON public.workflow_transitions
  FOR SELECT USING (
    category_id IN (SELECT id FROM public.workflow_categories WHERE is_active = true)
  );

-- RLS Policies for workflow_assignments
CREATE POLICY "super_admin_all_assignments" ON public.workflow_assignments
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_manage_assignments" ON public.workflow_assignments
  FOR ALL USING (
    entry_id IN (
      SELECT de.id FROM public.data_entries de
      JOIN public.groups g ON de.group_id = g.id
      WHERE g.owner_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
    )
  );

-- RLS Policies for workflow_history
CREATE POLICY "super_admin_all_history" ON public.workflow_history
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_read_history" ON public.workflow_history
  FOR SELECT USING (
    entry_id IN (
      SELECT de.id FROM public.data_entries de
      JOIN public.groups g ON de.group_id = g.id
      WHERE g.owner_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
    )
  );

-- Create indexes for performance
CREATE INDEX idx_workflow_stages_category ON public.workflow_stages(category_id);
CREATE INDEX idx_workflow_transitions_category ON public.workflow_transitions(category_id);
CREATE INDEX idx_workflow_assignments_entry ON public.workflow_assignments(entry_id);
CREATE INDEX idx_workflow_assignments_category ON public.workflow_assignments(category_id);
CREATE INDEX idx_workflow_history_entry ON public.workflow_history(entry_id);

-- Insert default workflow category (Optional)
INSERT INTO public.workflow_categories (name, description, is_active)
VALUES ('Sertifikasi Halal Standard', 'Workflow standar untuk sertifikasi halal UMKM', true)
ON CONFLICT DO NOTHING;
