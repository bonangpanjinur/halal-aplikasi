-- Phase 6: Document Templates & Forms Feature
-- Allows super admin and owner to create custom document templates and form fields

-- Create document_templates table
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL, -- 'form', 'document', 'checklist'
  content JSONB NOT NULL DEFAULT '{}', -- Stores template structure
  is_active BOOLEAN DEFAULT true,
  is_global BOOLEAN DEFAULT false, -- If true, available to all owners
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique template names per owner
  UNIQUE(owner_id, name)
);

-- Create form_fields table
CREATE TABLE IF NOT EXISTS public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- 'text', 'email', 'number', 'date', 'select', 'checkbox', 'textarea', 'file'
  field_label VARCHAR(255) NOT NULL,
  placeholder TEXT,
  is_required BOOLEAN DEFAULT false,
  field_order INT NOT NULL,
  validation_rules JSONB DEFAULT '{}', -- Stores regex, min/max, etc.
  options JSONB DEFAULT '[]', -- For select/checkbox fields
  help_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique field order per template
  UNIQUE(template_id, field_order)
);

-- Create template_submissions table (stores submitted form data)
CREATE TABLE IF NOT EXISTS public.template_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.document_templates(id),
  entry_id UUID NOT NULL REFERENCES public.data_entries(id) ON DELETE CASCADE,
  submission_data JSONB NOT NULL DEFAULT '{}', -- Stores field values
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'submitted', -- 'submitted', 'approved', 'rejected', 'revision'
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  review_notes TEXT
);

-- Create template_versions table (track template changes)
CREATE TABLE IF NOT EXISTS public.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  content JSONB NOT NULL,
  change_description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(template_id, version_number)
);

-- Enable RLS on all template tables
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_templates
CREATE POLICY "super_admin_all_templates" ON public.document_templates
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_manage_own_templates" ON public.document_templates
  FOR ALL USING (
    owner_id = auth.uid() OR 
    is_global = true OR
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
  );

CREATE POLICY "admin_read_templates" ON public.document_templates
  FOR SELECT USING (
    is_global = true OR
    owner_id IN (SELECT owner_id FROM public.profiles WHERE id = auth.uid())
  );

-- RLS Policies for form_fields
CREATE POLICY "super_admin_all_fields" ON public.form_fields
  FOR ALL USING (
    template_id IN (SELECT id FROM public.document_templates WHERE 
      auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'))
  );

CREATE POLICY "owner_manage_own_fields" ON public.form_fields
  FOR ALL USING (
    template_id IN (SELECT id FROM public.document_templates WHERE 
      owner_id = auth.uid() OR is_global = true)
  );

-- RLS Policies for template_submissions
CREATE POLICY "super_admin_all_submissions" ON public.template_submissions
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_manage_submissions" ON public.template_submissions
  FOR ALL USING (
    entry_id IN (
      SELECT de.id FROM public.data_entries de
      JOIN public.groups g ON de.group_id = g.id
      WHERE g.owner_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
    )
  );

CREATE POLICY "umkm_view_own_submissions" ON public.template_submissions
  FOR SELECT USING (
    entry_id IN (SELECT id FROM public.data_entries WHERE umkm_user_id = auth.uid())
  );

-- RLS Policies for template_versions
CREATE POLICY "super_admin_all_versions" ON public.template_versions
  FOR ALL USING (
    template_id IN (SELECT id FROM public.document_templates WHERE 
      auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'))
  );

CREATE POLICY "owner_read_versions" ON public.template_versions
  FOR SELECT USING (
    template_id IN (SELECT id FROM public.document_templates WHERE 
      owner_id = auth.uid() OR is_global = true)
  );

-- Create indexes for performance
CREATE INDEX idx_document_templates_owner ON public.document_templates(owner_id);
CREATE INDEX idx_document_templates_type ON public.document_templates(template_type);
CREATE INDEX idx_form_fields_template ON public.form_fields(template_id);
CREATE INDEX idx_template_submissions_entry ON public.template_submissions(entry_id);
CREATE INDEX idx_template_submissions_template ON public.template_submissions(template_id);
CREATE INDEX idx_template_versions_template ON public.template_versions(template_id);
