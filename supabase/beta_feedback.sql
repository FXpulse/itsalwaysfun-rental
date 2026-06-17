-- supabase/beta_feedback.sql
--
-- Inbox for in-product feedback submitted by beta-program tenants from the
-- floating widget in /admin. Stored cross-tenant (no tenant_id auto-scope)
-- so superadmin can see all submissions at /superadmin/beta-program/feedback.
-- We DO store tenant_id explicitly for filtering + context.
--
-- Idempotency / dedup: none. Same operator can submit as many notes as
-- they want — that's the point.

CREATE TABLE IF NOT EXISTS beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  submitted_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  submitted_by_email text,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('bug', 'feature', 'ux', 'other')),
  page_path text,
  body text NOT NULL CHECK (length(body) BETWEEN 5 AND 4000),
  resolved boolean DEFAULT false NOT NULL,
  resolved_at timestamp with time zone,
  resolved_by_email text,
  resolution_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_tenant_id ON beta_feedback (tenant_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_unresolved
  ON beta_feedback (created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_beta_feedback_category ON beta_feedback (category);

ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- The tenant's own admins can read + insert their own feedback.
DROP POLICY IF EXISTS beta_feedback_tenant_read ON beta_feedback;
CREATE POLICY beta_feedback_tenant_read ON beta_feedback
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT user_roles.tenant_id FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.is_active = true
        AND user_roles.role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS beta_feedback_tenant_insert ON beta_feedback;
CREATE POLICY beta_feedback_tenant_insert ON beta_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT user_roles.tenant_id FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.is_active = true
        AND user_roles.role IN ('admin', 'staff')
    )
  );

-- Superadmin can read + update (mark resolved) all rows.
DROP POLICY IF EXISTS beta_feedback_superadmin_all ON beta_feedback;
CREATE POLICY beta_feedback_superadmin_all ON beta_feedback
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.is_superadmin = true
    )
  );

-- Service role bypass (server-side inserts from actions).
DROP POLICY IF EXISTS beta_feedback_service_all ON beta_feedback;
CREATE POLICY beta_feedback_service_all ON beta_feedback
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
