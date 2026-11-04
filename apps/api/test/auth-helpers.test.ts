import { describe, expect, it } from "bun:test";
import { deepLinkSchemeFromState, signState, verifyState } from "../src/services/auth";

describe("deepLinkSchemeFromState", () => {
  it("extracts the scheme encoded after the OAuth nonce", () => {
    expect(deepLinkSchemeFromState("nonce~fitpal")).toBe("fitpal");
  });

  it("returns an empty string when no scheme was encoded", () => {
    expect(deepLinkSchemeFromState("nonce~")).toBe("");
    expect(deepLinkSchemeFromState("nonce")).toBe("");
    expect(deepLinkSchemeFromState(undefined)).toBe("");
  });

  it("rejects values that are not bare URL schemes", () => {
    expect(deepLinkSchemeFromState("nonce~https://evil.example")).toBe("");
    expect(deepLinkSchemeFromState("nonce~javascript:alert(1)")).toBe("");
    expect(deepLinkSchemeFromState("nonce~bad scheme")).toBe("");
    expect(deepLinkSchemeFromState(`nonce~${"a".repeat(65)}`)).toBe("");
  });
});

describe("OAuth state signing", () => {
  it("round-trips a signed state", async () => {
    const token = await signState("nonce~fitpal");
    expect(await verifyState(token)).toBe("nonce~fitpal");
  });

  it("rejects a tampered token", async () => {
    const token = await signState("nonce~fitpal");
    expect(await verifyState(`${token}x`)).toBeNull();
  });

  it("rejects malformed input", async () => {
    expect(await verifyState("not-a-jwt")).toBeNull();
  });
});
