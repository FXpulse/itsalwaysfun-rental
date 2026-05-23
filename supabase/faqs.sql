-- =====================================================
-- FAQs table — editable from admin, displayed on /info/faqs
-- =====================================================

CREATE TABLE IF NOT EXISTS faqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(is_active);
CREATE INDEX IF NOT EXISTS idx_faqs_order ON faqs(display_order);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_active_faqs ON faqs;
CREATE POLICY public_read_active_faqs
  ON faqs FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS service_role_all_faqs ON faqs;
CREATE POLICY service_role_all_faqs
  ON faqs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION bump_faqs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS faqs_updated_at ON faqs;
CREATE TRIGGER faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION bump_faqs_updated_at();

-- Seed defaults (idempotent on question)
INSERT INTO faqs (question, answer, display_order) VALUES
  ('What areas do you serve?', 'Jacksonville, FL and surrounding areas within 30 miles. Delivery is FREE within our service area.', 1),
  ('How far in advance should I book?', 'We recommend booking at least 7 days in advance, or 2 weeks for weekends and holidays. Popular dates fill up fast — earlier is better.', 2),
  ('What''s included in the rental price?', 'The price includes: delivery, professional setup, and pickup at the end of your event. All equipment is cleaned and sanitized between rentals.', 3),
  ('Do I need to provide power?', 'Yes — one standard 110V outlet within 50 feet of the setup location. If no outlet is available, we can supply a generator for an additional fee.', 4),
  ('What happens if it rains?', 'Safety policy: we cannot operate bounce houses in rain or high winds. Contact us at least 24 hours before your event if rain is forecast — we''ll work with you to reschedule or refund.', 5),
  ('What payment methods do you accept?', 'Credit/debit cards (online via the website), Venmo, Zelle, cash. Full payment is required to confirm your booking — 100% upfront, no deposit/balance system.', 6),
  ('Can I cancel or reschedule?', 'You can reschedule up to 7 days before your event with no fee. Cancellations within 48 hours of your event are non-refundable.', 7),
  ('How long can I keep the rental?', 'Standard rental is a full day (typically 9 AM – 5 PM but customizable). Need it longer? Contact us — multi-day rates available.', 8),
  ('Is the equipment safe?', 'Yes. All inflatables are commercial-grade, inspected before every rental, and meet ASTM safety standards. We provide setup instructions and supervision guidelines.', 9),
  ('Do you need an adult to supervise?', 'Yes — an adult must be present at all times when children are using the equipment. We''ll review safety rules with you at setup.', 10)
ON CONFLICT DO NOTHING;

SELECT id, question, display_order, is_active FROM faqs ORDER BY display_order;
