-- Phase 6: User Ratings & Feedback Feature
-- Allows UMKM to rate their experience and provide feedback on the application

-- Create app_ratings table
CREATE TABLE IF NOT EXISTS public.app_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.data_entries(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
  title VARCHAR(255),
  comment TEXT,
  category VARCHAR(50) DEFAULT 'general', -- 'general', 'workflow', 'support', 'ui', 'performance'
  status VARCHAR(50) DEFAULT 'submitted', -- 'submitted', 'acknowledged', 'resolved'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one rating per user per entry per day
  UNIQUE(user_id, entry_id, DATE(created_at))
);

-- Create rating_responses table (for admin responses to ratings)
CREATE TABLE IF NOT EXISTS public.rating_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES public.app_ratings(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(rating_id)
);

-- Create rating_analytics table (aggregated rating data)
CREATE TABLE IF NOT EXISTS public.rating_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period DATE NOT NULL, -- YYYY-MM-DD for daily aggregation
  total_ratings INT DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  rating_1_count INT DEFAULT 0,
  rating_2_count INT DEFAULT 0,
  rating_3_count INT DEFAULT 0,
  rating_4_count INT DEFAULT 0,
  rating_5_count INT DEFAULT 0,
  category_breakdown JSONB DEFAULT '{}', -- Breakdown by category
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(period)
);

-- Create feedback_categories table
CREATE TABLE IF NOT EXISTS public.feedback_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  display_order INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all rating tables
ALTER TABLE public.app_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_ratings
CREATE POLICY "users_create_own_ratings" ON public.app_ratings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_view_own_ratings" ON public.app_ratings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "super_admin_all_ratings" ON public.app_ratings
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_view_team_ratings" ON public.app_ratings
  FOR SELECT USING (
    user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.owner_id = auth.uid() OR p.id = auth.uid()
    ) OR
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
  );

-- RLS Policies for rating_responses
CREATE POLICY "super_admin_manage_responses" ON public.rating_responses
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_manage_responses" ON public.rating_responses
  FOR ALL USING (
    rating_id IN (
      SELECT id FROM public.app_ratings WHERE
      user_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "users_view_responses" ON public.rating_responses
  FOR SELECT USING (
    rating_id IN (SELECT id FROM public.app_ratings WHERE user_id = auth.uid())
  );

-- RLS Policies for rating_analytics
CREATE POLICY "super_admin_all_analytics" ON public.rating_analytics
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

CREATE POLICY "owner_view_analytics" ON public.rating_analytics
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'owner'));

-- RLS Policies for feedback_categories
CREATE POLICY "all_view_categories" ON public.feedback_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "super_admin_manage_categories" ON public.feedback_categories
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'));

-- Create indexes for performance
CREATE INDEX idx_app_ratings_user ON public.app_ratings(user_id);
CREATE INDEX idx_app_ratings_entry ON public.app_ratings(entry_id);
CREATE INDEX idx_app_ratings_category ON public.app_ratings(category);
CREATE INDEX idx_app_ratings_created ON public.app_ratings(created_at);
CREATE INDEX idx_rating_responses_rating ON public.rating_responses(rating_id);
CREATE INDEX idx_rating_analytics_period ON public.rating_analytics(period);

-- Insert default feedback categories
INSERT INTO public.feedback_categories (name, description, icon, is_active, display_order)
VALUES 
  ('Umum', 'Feedback umum tentang aplikasi', 'MessageSquare', true, 1),
  ('Workflow', 'Feedback tentang alur kerja dan proses', 'Workflow', true, 2),
  ('Dukungan', 'Feedback tentang layanan dukungan', 'HelpCircle', true, 3),
  ('Antarmuka', 'Feedback tentang desain dan kemudahan penggunaan', 'Layout', true, 4),
  ('Performa', 'Feedback tentang kecepatan dan performa', 'Zap', true, 5)
ON CONFLICT DO NOTHING;

-- Create function to update rating analytics
CREATE OR REPLACE FUNCTION update_rating_analytics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.rating_analytics (
    period,
    total_ratings,
    average_rating,
    rating_1_count,
    rating_2_count,
    rating_3_count,
    rating_4_count,
    rating_5_count
  )
  SELECT
    DATE(NEW.created_at),
    COUNT(*),
    ROUND(AVG(rating)::NUMERIC, 2),
    COUNT(CASE WHEN rating = 1 THEN 1 END),
    COUNT(CASE WHEN rating = 2 THEN 1 END),
    COUNT(CASE WHEN rating = 3 THEN 1 END),
    COUNT(CASE WHEN rating = 4 THEN 1 END),
    COUNT(CASE WHEN rating = 5 THEN 1 END)
  FROM public.app_ratings
  WHERE DATE(created_at) = DATE(NEW.created_at)
  ON CONFLICT (period) DO UPDATE SET
    total_ratings = EXCLUDED.total_ratings,
    average_rating = EXCLUDED.average_rating,
    rating_1_count = EXCLUDED.rating_1_count,
    rating_2_count = EXCLUDED.rating_2_count,
    rating_3_count = EXCLUDED.rating_3_count,
    rating_4_count = EXCLUDED.rating_4_count,
    rating_5_count = EXCLUDED.rating_5_count,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update analytics on new rating
CREATE TRIGGER update_analytics_on_rating
AFTER INSERT ON public.app_ratings
FOR EACH ROW
EXECUTE FUNCTION update_rating_analytics();
