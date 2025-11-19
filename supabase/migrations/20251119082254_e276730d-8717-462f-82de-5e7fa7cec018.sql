-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text NOT NULL UNIQUE,
  name text NOT NULL,
  class text NOT NULL,
  grade text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create base_schedule table for storing the base timetable from Excel
CREATE TABLE IF NOT EXISTS public.base_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text NOT NULL,
  day text NOT NULL,
  hour_number integer NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(student_id, day, hour_number),
  CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies for students (anyone can view)
CREATE POLICY "Anyone can view students"
  ON public.students
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert students"
  ON public.students
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update students"
  ON public.students
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete students"
  ON public.students
  FOR DELETE
  USING (true);

-- RLS Policies for base_schedule (anyone can view)
CREATE POLICY "Anyone can view base schedule"
  ON public.base_schedule
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert base schedule"
  ON public.base_schedule
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update base schedule"
  ON public.base_schedule
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete base schedule"
  ON public.base_schedule
  FOR DELETE
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students(grade);
CREATE INDEX IF NOT EXISTS idx_base_schedule_student ON public.base_schedule(student_id);
CREATE INDEX IF NOT EXISTS idx_base_schedule_day ON public.base_schedule(day);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_students_updated_at();