-- Create teachers table
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  id_code TEXT NOT NULL UNIQUE,
  normalized_id_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Create policies for teachers table
CREATE POLICY "Anyone can view teachers" 
ON public.teachers 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert teachers" 
ON public.teachers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update teachers" 
ON public.teachers 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete teachers" 
ON public.teachers 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.update_students_updated_at();