-- Add INSERT, UPDATE, DELETE policies for schedule_overrides table
CREATE POLICY "Anyone can insert schedule overrides"
ON public.schedule_overrides
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update schedule overrides"
ON public.schedule_overrides
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete schedule overrides"
ON public.schedule_overrides
FOR DELETE
USING (true);

-- Add INSERT, UPDATE, DELETE policies for reset_dates table
CREATE POLICY "Anyone can insert reset dates"
ON public.reset_dates
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update reset dates"
ON public.reset_dates
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete reset dates"
ON public.reset_dates
FOR DELETE
USING (true);