import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, signState, verifyState } from "../src/modules/google-calendar/google-crypto.js";

const secret = "x".repeat(40);

describe("google token crypto", () => {
  it("round-trips a refresh token and never stores it in the clear", () => {
    const encrypted = encryptToken("1//refresh-token", secret);
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptToken(encrypted, secret)).toBe("1//refresh-token");
    expect(() => decryptToken(encrypted, "y".repeat(40))).toThrow();
  });

  it("accepts a fresh OAuth state and rejects tampered or expired ones", () => {
    const state = signState("user-1", secret, 1_000);
    expect(verifyState(state, secret, 2_000)).toBe("user-1");
    expect(verifyState(state, secret, 1_000 + 11 * 60_000)).toBeNull();
    expect(verifyState(`${state}x`, secret, 2_000)).toBeNull();
    expect(verifyState(state, "z".repeat(40), 2_000)).toBeNull();
  });
});
