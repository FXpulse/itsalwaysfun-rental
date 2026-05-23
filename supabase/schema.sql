-- =====================================================
-- It's Always Fun, LLC — Rental Inventory Schema
-- =====================================================
-- Run in Supabase SQL Editor (Project → SQL Editor → New query)
-- This file is idempotent: re-running drops & recreates tables.
-- =====================================================

-- Cleanup (idempotent re-runs)
DROP TABLE IF EXISTS blocked_dates CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- =====================================================
-- products
-- =====================================================
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL,
    price_per_day   INTEGER NOT NULL CHECK (price_per_day >= 0),  -- cents
    stock           INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
    image_url       TEXT,
    ghl_listing_id  TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    setup_area      TEXT,
    actual_size     TEXT,
    outlets_required INTEGER DEFAULT 1,
    age_group       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_slug ON products(slug);

-- =====================================================
-- bookings
-- =====================================================
CREATE TABLE bookings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghl_contact_id              TEXT,
    ghl_opportunity_id          TEXT,
    customer_first_name         TEXT NOT NULL,
    customer_last_name          TEXT NOT NULL,
    customer_email              TEXT NOT NULL,
    customer_phone              TEXT,
    customer_address            TEXT,
    event_date                  DATE NOT NULL,
    start_time                  TIME,
    end_time                    TIME,
    product_id                  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name                TEXT NOT NULL,
    total_amount                INTEGER NOT NULL CHECK (total_amount >= 0),  -- cents
    stripe_payment_intent_id    TEXT,
    stripe_payment_status       TEXT NOT NULL DEFAULT 'pending'
        CHECK (stripe_payment_status IN ('pending','paid','refunded','failed')),
    booking_status              TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (booking_status IN (
            'pending_payment','confirmed','delivered','completed','cancelled'
        )),
    hold_expires_at             TIMESTAMPTZ,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_event_date ON bookings(event_date);
CREATE INDEX idx_bookings_product_date ON bookings(product_id, event_date);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_email ON bookings(customer_email);
CREATE INDEX idx_bookings_ghl_contact ON bookings(ghl_contact_id);
CREATE INDEX idx_bookings_hold_expires ON bookings(hold_expires_at)
    WHERE booking_status = 'pending_payment';

-- =====================================================
-- blocked_dates  (admin manual blocks: maintenance, damaged, etc.)
-- =====================================================
CREATE TABLE blocked_dates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    blocked_date    DATE NOT NULL,
    reason          TEXT,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (product_id, blocked_date)
);

CREATE INDEX idx_blocked_dates_date ON blocked_dates(blocked_date);
CREATE INDEX idx_blocked_dates_product ON blocked_dates(product_id);

-- =====================================================
-- updated_at trigger for bookings
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- Products: public read for active items, full access for service role
CREATE POLICY "public_read_active_products"
    ON products FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "service_role_all_products"
    ON products FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- Bookings: service role only (no public access — admin via service key)
CREATE POLICY "service_role_all_bookings"
    ON bookings FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- Blocked dates: public read (so availability API can see them), service role write
CREATE POLICY "public_read_blocked_dates"
    ON blocked_dates FOR SELECT
    USING (TRUE);

CREATE POLICY "service_role_all_blocked_dates"
    ON blocked_dates FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- =====================================================
-- Helper view: product_availability
-- =====================================================
CREATE OR REPLACE VIEW product_availability AS
SELECT
    p.id              AS product_id,
    p.slug,
    p.name,
    p.stock,
    COALESCE(b.booked_count, 0)   AS booked_count,
    COALESCE(bd.blocked_count, 0) AS blocked_count
FROM products p
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS booked_count
    FROM bookings
    WHERE bookings.product_id = p.id
      AND bookings.booking_status IN ('pending_payment','confirmed','delivered')
      AND bookings.event_date = CURRENT_DATE
) b ON TRUE
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS blocked_count
    FROM blocked_dates
    WHERE blocked_dates.product_id = p.id
      AND blocked_dates.blocked_date = CURRENT_DATE
) bd ON TRUE
WHERE p.is_active = TRUE;
