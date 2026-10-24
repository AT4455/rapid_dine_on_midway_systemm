import { describe, expect, it } from "vitest";
import { assertRestaurantOwns } from "@/lib/auth/authorization";
import { assertSameOrigin, HttpError } from "@/lib/http";

function captureError(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
}

describe("assertRestaurantOwns", () => {
  it("accepts the owning restaurant", () => {
    expect(() => assertRestaurantOwns({ restaurant: { id: "restaurant-1" } }, "restaurant-1")).not.toThrow();
  });

  it("rejects a different restaurant with a 403", () => {
    const error = captureError(() => assertRestaurantOwns({ restaurant: { id: "restaurant-1" } }, "restaurant-2"));
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe("forbidden");
  });

  it("uses the supplied message", () => {
    const error = captureError(() =>
      assertRestaurantOwns({ restaurant: { id: "restaurant-1" } }, "restaurant-2", "Not your kitchen."),
    );
    expect((error as HttpError).message).toBe("Not your kitchen.");
  });
});

describe("assertSameOrigin", () => {
  it("allows a same-host browser request", () => {
    const request = new Request("http://localhost:3000/api/orders", {
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("allows non-browser requests without an Origin header", () => {
    const request = new Request("http://localhost:3000/api/orders", { headers: { host: "localhost:3000" } });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("blocks a cross-site browser request", () => {
    const request = new Request("http://localhost:3000/api/orders", {
      headers: { origin: "https://evil.example", host: "localhost:3000" },
    });
    const error = captureError(() => assertSameOrigin(request));
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe("csrf_blocked");
  });
});
