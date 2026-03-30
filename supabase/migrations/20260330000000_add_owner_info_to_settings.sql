-- Add owner/company information to app_settings
INSERT INTO public.app_settings (key, value) VALUES
  ('platform_owner_name', 'PT HalalTrack Indonesia'),
  ('platform_owner_email', 'owner@halaltrack.id'),
  ('platform_owner_phone', '+62-21-XXXX-XXXX'),
  ('platform_owner_address', 'Jakarta, Indonesia'),
  ('platform_support_email', 'support@halaltrack.id'),
  ('platform_support_phone', '+62-21-XXXX-XXXX'),
  ('pricing_description', 'Tarif platform dihitung berdasarkan jumlah sertifikat halal yang berhasil diselesaikan. Setiap owner akan ditagih sesuai dengan paket langganan dan volume sertifikat yang diproses.')
ON CONFLICT DO NOTHING;
