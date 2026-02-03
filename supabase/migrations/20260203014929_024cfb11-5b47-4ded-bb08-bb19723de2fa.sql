-- Create storage bucket for lot photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lot-photos', 'lot-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access to lot photos
CREATE POLICY "Lot photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'lot-photos');

-- Create policy for authenticated users to upload lot photos
CREATE POLICY "Authenticated users can upload lot photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lot-photos' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for owners to delete their lot photos
CREATE POLICY "Users can delete their own lot photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lot-photos'
  AND auth.uid() IS NOT NULL
);

-- Create policy for owners to update their lot photos
CREATE POLICY "Users can update their own lot photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'lot-photos'
  AND auth.uid() IS NOT NULL
);