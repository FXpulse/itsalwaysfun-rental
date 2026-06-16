/**
 * Multi-tenant isolation tests
 *
 * Asserts que el proxy scope.ts efectivamente impide cross-tenant reads/writes.
 * Si estos tests pasan, sabemos que un dev que olvida pasar tenant context
 * NO va a leer datos de otro tenant — el proxy lo bloquea.
 *
 * Estos tests SOLO corren con TEST_SUPABASE_URL configurado (ver fixtures.ts).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { scopeToTenant } from "@/lib/tenant/scope";
import { createTestTenant, createTestProduct, cleanupTenant } from "./fixtures";

const URL = process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe("multi-tenant isolation via scope.ts", () => {
  let tenantA: string;
  let tenantB: string;
  let productA: string;
  let productB: string;

  beforeEach(async () => {
    tenantA = await createTestTenant("isol-A");
    tenantB = await createTestTenant("isol-B");
    productA = (await createTestProduct(tenantA, { name: "A Bouncer" })).id;
    productB = (await createTestProduct(tenantB, { name: "B Bouncer" })).id;
  });

  afterEach(async () => {
    await cleanupTenant(tenantA);
    await cleanupTenant(tenantB);
  });

  it("scoped client only sees its own tenant's products", async () => {
    const raw = createClient(URL, KEY, { auth: { persistSession: false } });
    const scoped = scopeToTenant(raw, tenantA);

    const { data: products } = await scoped.from("products").select("id, name");
    const names = (products as { id: string; name: string }[] | null)?.map((p) => p.name) ?? [];

    expect(names).toContain("A Bouncer");
    expect(names).not.toContain("B Bouncer");
  });

  it("scoped client cannot insert without tenant_id leak", async () => {
    const raw = createClient(URL, KEY, { auth: { persistSession: false } });
    const scoped = scopeToTenant(raw, tenantA);

    // Insertar sin pasar tenant_id — el proxy debería inyectarlo
    const { data, error } = await scoped
      .from("products")
      .insert({
        slug: `injected-${Date.now()}`,
        name: "Injected via scope",
        base_price_cents: 9999,
        stock: 1,
      })
      .select("id, tenant_id")
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect((data as any).tenant_id).toBe(tenantA);
  });

  it("scoped client cannot update another tenant's row", async () => {
    const raw = createClient(URL, KEY, { auth: { persistSession: false } });
    const scoped = scopeToTenant(raw, tenantA);

    // Intentar actualizar productB usando la sesión de tenantA — no debería matchear
    const { data, error } = await scoped
      .from("products")
      .update({ name: "HIJACKED" })
      .eq("id", productB)
      .select("id");

    // No hay error de SQL, pero el WHERE incluyó `tenant_id = tenantA AND id = productB`
    // → 0 filas afectadas
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Verificación contra-prueba: tenantB con el raw client SÍ ve su producto sin cambios
    const { data: stillB } = await raw.from("products").select("name").eq("id", productB).single();
    expect((stillB as any)?.name).toBe("B Bouncer");
  });
});
