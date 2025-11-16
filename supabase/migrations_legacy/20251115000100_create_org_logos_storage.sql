-- Create storage bucket for organization logos
-- Allows authenticated users to upload their org logos

BEGIN;

-- Create public bucket for org logos (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public',
  'public',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

-- Storage policy: Allow authenticated users to upload to their org folder
CREATE POLICY "Users can upload org logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public' 
  AND (storage.foldername(name))[1] = 'org-logos'
  AND auth.role() = 'authenticated'
);

-- Storage policy: Allow authenticated users to read all public files
CREATE POLICY "Public files are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public');

-- Storage policy: Allow org admins to delete their org logos
CREATE POLICY "Org admins can delete their logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'org-logos'
  AND auth.role() = 'authenticated'
);

-- Storage policy: Allow org admins to update their logos
CREATE POLICY "Org admins can update their logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'org-logos'
  AND auth.role() = 'authenticated'
);

COMMIT;

