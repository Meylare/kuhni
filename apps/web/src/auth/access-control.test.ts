import { describe, expect, it } from "vitest";

describe("access-control gate decision", () => {
  type GateState = {
    session: { user: { email: string } } | null;
    isOwner: boolean | null;
    loading: boolean;
    checkingRole: boolean;
  };

  function resolveGateView(state: GateState): "login" | "loading" | "access_denied" | "main_app" {
    if (state.loading || (state.session && state.checkingRole && state.isOwner === null)) {
      return "loading";
    }
    if (!state.session) {
      return "login";
    }
    if (state.isOwner === false) {
      return "access_denied";
    }
    return "main_app";
  }

  it("returns login when there is no active session", () => {
    expect(
      resolveGateView({
        session: null,
        isOwner: null,
        loading: false,
        checkingRole: false,
      }),
    ).toBe("login");
  });

  it("returns loading while session or role is being checked", () => {
    expect(
      resolveGateView({
        session: { user: { email: "user@example.com" } },
        isOwner: null,
        loading: false,
        checkingRole: true,
      }),
    ).toBe("loading");
  });

  it("returns access_denied when user is authenticated but not an owner", () => {
    expect(
      resolveGateView({
        session: { user: { email: "worker@example.com" } },
        isOwner: false,
        loading: false,
        checkingRole: false,
      }),
    ).toBe("access_denied");
  });

  it("returns main_app when authenticated user is an owner", () => {
    expect(
      resolveGateView({
        session: { user: { email: "owner@example.com" } },
        isOwner: true,
        loading: false,
        checkingRole: false,
      }),
    ).toBe("main_app");
  });
});
