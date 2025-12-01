-- Create excel-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-files', 'excel-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to excel files
CREATE POLICY "Public read access for excel files"
ON storage.objects FOR SELECT
USING (bucket_id = 'excel-files');

-- Allow anyone to upload excel files (for admin functionality)
CREATE POLICY "Allow upload excel files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'excel-files');

-- Allow anyone to update excel files
CREATE POLICY "Allow update excel files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'excel-files');

-- Allow anyone to delete excel files
CREATE POLICY "Allow delete excel files"
ON storage.objects FOR DELETE
USING (bucket_id = 'excel-files');