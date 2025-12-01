-- Create attendance_records table
CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id text NOT NULL,
    student_name text NOT NULL,
    student_class text NOT NULL,
    student_grade text NOT NULL,
    date date NOT NULL,
    hour_number integer NOT NULL,
    is_present boolean DEFAULT true NOT NULL,
    is_justified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_records_hour_number_check CHECK (((hour_number >= 1) AND (hour_number <= 8)))
);

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_unique_entry UNIQUE (teacher_id, student_name, date, hour_number);

-- Track updated_at automatically
CREATE OR REPLACE FUNCTION public.update_attendance_records_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.update_attendance_records_updated_at();

-- Helpful indexes
CREATE INDEX idx_attendance_records_teacher_date
  ON public.attendance_records USING btree (teacher_id, date);

CREATE INDEX idx_attendance_records_student_date
  ON public.attendance_records USING btree (student_name, date);

CREATE INDEX idx_attendance_records_class
  ON public.attendance_records USING btree (student_class);

CREATE INDEX idx_attendance_records_grade
  ON public.attendance_records USING btree (student_grade);

-- Enable RLS and open policies (same as existing tables)
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attendance"
ON public.attendance_records FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert attendance"
ON public.attendance_records FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update attendance"
ON public.attendance_records FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete attendance"
ON public.attendance_records FOR DELETE
USING (true);

