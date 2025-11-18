-- Fix security warnings by setting search_path on functions
DROP FUNCTION IF EXISTS public.update_schedule_overrides_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_reset_dates_updated_at() CASCADE;

-- Recreate functions with proper search_path
CREATE OR REPLACE FUNCTION public.update_schedule_overrides_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_reset_dates_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_schedule_overrides_updated_at
  BEFORE UPDATE ON public.schedule_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_overrides_updated_at();

CREATE TRIGGER update_reset_dates_updated_at
  BEFORE UPDATE ON public.reset_dates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reset_dates_updated_at();