-- Create permanent_schedule_changes table
CREATE TABLE IF NOT EXISTS public.permanent_schedule_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  hour_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  teacher TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, day_of_week, hour_number)
);

-- Enable Row Level Security
ALTER TABLE public.permanent_schedule_changes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view permanent schedule changes" 
ON public.permanent_schedule_changes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert permanent schedule changes" 
ON public.permanent_schedule_changes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update permanent schedule changes" 
ON public.permanent_schedule_changes 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete permanent schedule changes" 
ON public.permanent_schedule_changes 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_permanent_schedule_changes_updated_at
BEFORE UPDATE ON public.permanent_schedule_changes
FOR EACH ROW
EXECUTE FUNCTION public.update_students_updated_at();