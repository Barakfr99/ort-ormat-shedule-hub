-- Add is_permanent column to schedule_overrides table
ALTER TABLE public.schedule_overrides 
ADD COLUMN is_permanent boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX idx_schedule_overrides_permanent 
ON public.schedule_overrides(is_permanent) 
WHERE is_permanent = true;