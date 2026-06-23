-- Transactional business expenses (general overhead, contractor pay, supplies,
-- marketing, etc.). Distinct from:
--   booking_expenses  — per-booking costs that need a booking_id
--   overhead_costs    — recurring MONTHLY overhead (rent, software, insurance)
--
-- Each row is a point-in-time expense (one credit card swipe, one cash payment,
-- one transfer) with an amount + vendor + category. This is the table the
-- "Business expense report" Excel maps onto.

CREATE TABLE IF NOT EXISTS public.business_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  expense_date    date NOT NULL,
  -- How the money left the business
  account         text NOT NULL CHECK (account IN (
                    'credit_card', 'bank', 'bank_zelle', 'cash', 'check', 'other'
                  )),
  -- High-level bucket (references business_expense_categories.key); free text
  -- so admins can roll out new categories without a schema change.
  category        text NOT NULL,
  -- Who got paid
  vendor_name     text NOT NULL,
  -- Free-text sub-detail (the EXPENSE DETAILS column in the spreadsheet —
  -- "Marketing Supplies", "Website Services", contractor name, etc.)
  description     text,
  amount_cents    integer NOT NULL CHECK (amount_cents >= 0),
  -- When the expense is a payroll row to an independent contractor, this
  -- denormalized name flows into the 1099-NEC totals at year-end.
  contractor_name text,
  -- For dedup of imports: SHA-256 of (date, account, category, vendor,
  -- description, amount, file_offset). Manual entries leave this NULL and
  -- are never deduped.
  source_hash     text,
  notes           text,
  recorded_by     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_expenses_tenant_date_idx
  ON public.business_expenses (tenant_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS business_expenses_tenant_category_idx
  ON public.business_expenses (tenant_id, category);
CREATE INDEX IF NOT EXISTS business_expenses_tenant_contractor_idx
  ON public.business_expenses (tenant_id, contractor_name)
  WHERE contractor_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_expenses_source_hash_unique
  ON public.business_expenses (tenant_id, source_hash)
  WHERE source_hash IS NOT NULL;

ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;

-- Per-tenant configurable categories. Same pattern as overhead_categories.
CREATE TABLE IF NOT EXISTS public.business_expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         text NOT NULL,
  label       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS business_expense_categories_tenant_idx
  ON public.business_expense_categories (tenant_id, sort_order);

ALTER TABLE public.business_expense_categories ENABLE ROW LEVEL SECURITY;

-- ── RLS policies (scope by header-injected x-tenant-id like the other tables) ──

CREATE POLICY tenant_isolation ON public.business_expenses
  USING (
    public.is_superadmin(auth.uid())
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id)::text = COALESCE(
      ((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text),
      ''::text
    )
  )
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id)::text = COALESCE(
      ((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text),
      ''::text
    )
  );

CREATE POLICY tenant_isolation ON public.business_expense_categories
  USING (
    public.is_superadmin(auth.uid())
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id)::text = COALESCE(
      ((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text),
      ''::text
    )
  )
  WITH CHECK (
    public.is_superadmin(auth.uid())
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id)::text = COALESCE(
      ((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text),
      ''::text
    )
  );

-- ── Seed default categories for ALL existing tenants ─────────────────────────
-- (Matches the CONCEPT column values from Ludmila's IAF spreadsheet so the
-- import lands cleanly. New tenants will get the same set via a SECURITY
-- DEFINER seed function called at tenant creation; that piece is a separate
-- migration when /signup/actions.ts gets updated.)

INSERT INTO public.business_expense_categories (tenant_id, key, label, sort_order)
SELECT t.id, c.key, c.label, c.sort_order
  FROM public.tenants t
 CROSS JOIN (VALUES
   ('supplies',       '🧰 Supplies',                    10),
   ('marketing',      '📣 Marketing',                   20),
   ('services',       '🛠 Services',                    30),
   ('transportation', '🚐 Transportation',              40),
   ('insurance',      '🛡 Insurance',                   50),
   ('payroll',        '💸 Payroll / contractors',       60),
   ('travel',         '✈ Travel',                       70),
   ('owner_capital',  '🏦 Owner capital / loans',       80),
   ('membership',     '💳 Membership / fees',           85),
   ('other',          '🗂 Other',                      999)
 ) AS c(key, label, sort_order)
ON CONFLICT (tenant_id, key) DO NOTHING;
