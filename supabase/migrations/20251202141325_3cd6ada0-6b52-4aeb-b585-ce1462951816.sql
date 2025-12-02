-- Add unique constraint on normalized_id_code for teachers table
ALTER TABLE public.teachers ADD CONSTRAINT teachers_normalized_id_code_unique UNIQUE (normalized_id_code);