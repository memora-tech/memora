INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'card-media',
    'card-media',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/webm', 'audio/ogg']
  ),
  (
    'generation-uploads',
    'generation-uploads',
    false,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS card_media_select_own ON storage.objects;
CREATE POLICY card_media_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'card-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS card_media_insert_own ON storage.objects;
CREATE POLICY card_media_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'card-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS card_media_delete_own ON storage.objects;
CREATE POLICY card_media_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'card-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS generation_uploads_select_own ON storage.objects;
CREATE POLICY generation_uploads_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'generation-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS generation_uploads_insert_own ON storage.objects;
CREATE POLICY generation_uploads_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generation-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS generation_uploads_delete_own ON storage.objects;
CREATE POLICY generation_uploads_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'generation-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
