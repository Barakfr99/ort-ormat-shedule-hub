-- Create storage bucket for Excel files
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-files', 'excel-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to Excel files
CREATE POLICY "Public read access for excel files"
ON storage.objects FOR SELECT
USING (bucket_id = 'excel-files');

-- Allow authenticated users to upload/update Excel files (for admin)
CREATE POLICY "Admin can upload excel files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'excel-files');

CREATE POLICY "Admin can update excel files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'excel-files');

CREATE POLICY "Admin can delete excel files"
ON storage.objects FOR DELETE
USING (bucket_id = 'excel-files');