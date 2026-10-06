import { describe, expect, it } from "vitest";
import { clientKey } from "./waitlist";

describe("clé de limitation de débit", () => {
  it("empreinte de la première IP de x-forwarded-for, jamais l'IP elle-même", () => {
    const key = clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), "secret");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.7" }), "secret")).toBe(key);
  });

  it("dépend du secret et de l'IP ; sans IP, pas de clé", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(clientKey(headers, "a")).not.toBe(clientKey(headers, "b"));
    expect(clientKey(headers, "a")).not.toBe(
      clientKey(new Headers({ "x-forwarded-for": "203.0.113.8" }), "a"),
    );
    expect(clientKey(new Headers(), "a")).toBeNull();
  });
});
