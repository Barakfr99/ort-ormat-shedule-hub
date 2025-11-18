-- Create table for schedule overrides
CREATE TABLE IF NOT EXISTS public.schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  date DATE NOT NULL,
  hour_number INTEGER NOT NULL CHECK (hour_number >= 1 AND hour_number <= 8),
  override_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date, hour_number)
);

-- Create table for reset dates
CREATE TABLE IF NOT EXISTS public.reset_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL UNIQUE,
  reset_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reset_dates ENABLE ROW LEVEL SECURITY;

-- Public read access (students can view schedules)
CREATE POLICY "Anyone can view schedule overrides"
  ON public.schedule_overrides
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view reset dates"
  ON public.reset_dates
  FOR SELECT
  USING (true);

-- Create update trigger for schedule_overrides
CREATE OR REPLACE FUNCTION public.update_schedule_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schedule_overrides_updated_at
  BEFORE UPDATE ON public.schedule_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_overrides_updated_at();

-- Create update trigger for reset_dates
CREATE OR REPLACE FUNCTION public.update_reset_dates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reset_dates_updated_at
  BEFORE UPDATE ON public.reset_dates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reset_dates_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_schedule_overrides_student_date ON public.schedule_overrides(student_id, date);
CREATE INDEX idx_reset_dates_student ON public.reset_dates(student_id);