import { describe, expect, it } from "vitest";

import { decodeJwtPayload, validateAnonKeyRole } from "./config";

describe("Step B5: Supabase JWT Anon Key Validation", () => {
  // Helper to create a base64url JWT
  function makeJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.dummy_signature`;
  }

  it("decodes a valid JWT payload correctly", () => {
    const token = makeJwt({ role: "anon", iss: "supabase", exp: 1999999999 });
    const payload = decodeJwtPayload(token);
    expect(payload).not.toBeNull();
    expect(payload?.role).toBe("anon");
    expect(payload?.iss).toBe("supabase");
  });

  it("returns null for malformed or non-jwt strings", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("allows standard anon token", () => {
    const anonToken = makeJwt({ role: "anon", iss: "supabase" });
    const check = validateAnonKeyRole(anonToken);
    expect(check.valid).toBe(true);
    expect(check.reason).toBeUndefined();
  });

  it("rejects token with role 'service_role' in decoded payload", () => {
    const serviceToken = makeJwt({ role: "service_role", iss: "supabase" });
    const check = validateAnonKeyRole(serviceToken);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("service_role");
  });

  it("rejects raw string containing service_role", () => {
    const rawServiceKey = "sbp_service_role_secret_key_12345";
    const check = validateAnonKeyRole(rawServiceKey);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("service_role");
  });
});
