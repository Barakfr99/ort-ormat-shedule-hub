-- Create attendance_records table for teacher attendance tracking
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_class TEXT NOT NULL,
  student_grade TEXT NOT NULL,
  date DATE NOT NULL,
  hour_number INTEGER NOT NULL,
  is_present BOOLEAN NOT NULL DEFAULT true,
  is_justified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, student_name, date, hour_number)
);

-- Enable Row Level Security
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create policies for open access (matching other tables)
CREATE POLICY "Anyone can view attendance records" 
ON public.attendance_records 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert attendance records" 
ON public.attendance_records 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update attendance records" 
ON public.attendance_records 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete attendance records" 
ON public.attendance_records 
FOR DELETE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_attendance_teacher_date ON public.attendance_records(teacher_id, date);
CREATE INDEX idx_attendance_student_date ON public.attendance_records(student_name, date);
CREATE INDEX idx_attendance_class_grade ON public.attendance_records(student_class, student_grade);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_students_updated_at();