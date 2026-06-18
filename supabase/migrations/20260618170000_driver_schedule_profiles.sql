-- Driver schedule + skills profile, used by the AI route optimizer.
-- Keyed by driver_email to match the existing pattern (user_roles + driver_tax_profiles
-- both lookup by email). Per-tenant rows so different tenants' drivers don't collide.

CREATE TABLE IF NOT EXISTS driver_schedule_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_email text NOT NULL,

  -- Skills: free-tag list. Typical values "small_inflatables", "large_slides",
  -- "trailer_pull", "solo_setup", "two_person_setup", "concession". The
  -- optimizer matches bookings → drivers using fuzzy contains.
  skills text[] DEFAULT ARRAY[]::text[],

  -- Home ZIP for geographic clustering. Optimizer prefers grouping nearby
  -- stops with the driver who lives closest. NULL = no preference.
  home_zip text,

  -- Cap on hours scheduled per ISO week. Defaults to 40. The optimizer
  -- enforces this softly — exceeding means an explicit operator override.
  weekly_max_hours int NOT NULL DEFAULT 40,

  -- ISO weekday integers the driver is available. 0=Sun..6=Sat.
  -- Default empty array means "unknown — treat as available all days."
  available_days int[] DEFAULT ARRAY[]::int[],

  -- Free-form operator notes ("prefers morning deliveries", "do not pair
  -- with John", etc.). Passed to the LLM as soft context.
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT driver_schedule_profiles_tenant_email_uniq
    UNIQUE (tenant_id, driver_email)
);

CREATE INDEX IF NOT EXISTS idx_driver_schedule_profiles_tenant
  ON driver_schedule_profiles (tenant_id);

-- RLS — same pattern as the rest of the per-tenant tables.
ALTER TABLE driver_schedule_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON driver_schedule_profiles;
CREATE POLICY tenant_isolation ON driver_schedule_profiles
  FOR ALL
  USING (is_superadmin(auth.uid()) OR tenant_id = current_tenant_id())
  WITH CHECK (is_superadmin(auth.uid()) OR tenant_id = current_tenant_id());

-- updated_at trigger so we don't have to set it on every UPDATE.
CREATE OR REPLACE FUNCTION touch_driver_schedule_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS driver_schedule_profiles_touch_updated ON driver_schedule_profiles;
CREATE TRIGGER driver_schedule_profiles_touch_updated
  BEFORE UPDATE ON driver_schedule_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_driver_schedule_profiles_updated_at();
