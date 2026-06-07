import { afterEach, describe, expect, it, vi } from "vitest";
import { driveMatrixMinutes, geocodeAddress } from "./ors";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("geocodeAddress", () => {
  it("returns lat/lng/label from the first feature", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        features: [
          {
            geometry: { coordinates: [-77.357107, 38.853923] },
            properties: { label: "12000 Government Center Pkwy, Fairfax, VA" },
          },
        ],
      }),
    );
    const r = await geocodeAddress("KEY", "12000 Government Center Pkwy");
    expect(r).toEqual({
      lat: 38.853923,
      lng: -77.357107,
      label: "12000 Government Center Pkwy, Fairfax, VA",
    });
  });

  it("throws when no feature is returned", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ features: [] }));
    await expect(geocodeAddress("KEY", "nowhere")).rejects.toThrow(/No location/);
  });

  it("reports an invalid/unauthorized key on 401/403", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({}, false, 403));
    await expect(geocodeAddress("BADKEY", "x")).rejects.toThrow(/invalid|unauthorized/i);
  });

  it("reports a rate limit on 429", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({}, false, 429));
    await expect(geocodeAddress("K", "x")).rejects.toThrow(/rate limit/i);
  });

  it("reports a network failure when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    await expect(geocodeAddress("K", "x")).rejects.toThrow(/reach OpenRouteService/i);
  });

  it("requires a key", async () => {
    await expect(geocodeAddress("  ", "x")).rejects.toThrow(/key/i);
  });
});

describe("driveMatrixMinutes", () => {
  it("converts seconds to rounded minutes, preserving destination order", async () => {
    const fetchMock = mockFetchOnce({ durations: [[1140, 2220, null]] });
    vi.stubGlobal("fetch", fetchMock);
    const mins = await driveMatrixMinutes(
      "KEY",
      { lat: 38.85, lng: -77.27 },
      [
        { lat: 38.81, lng: -77.21 },
        { lat: 38.99, lng: -77.31 },
        { lat: 38.7, lng: -77.1 },
      ],
    );
    expect(mins).toEqual([19, 37, null]);

    // request body shape: origin first, sources [0], destinations indexed 1..n
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.locations[0]).toEqual([-77.27, 38.85]);
    expect(body.sources).toEqual([0]);
    expect(body.destinations).toEqual([1, 2, 3]);
    expect(body.metrics).toEqual(["duration"]);
  });

  it("chunks large destination lists across multiple requests", async () => {
    // 200 destinations -> ceil(200/80) = 3 requests
    const fetchMock = vi.fn().mockImplementation(async (_url, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const n = body.destinations.length;
      return { ok: true, status: 200, json: async () => ({ durations: [Array(n).fill(600)] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const dests = Array.from({ length: 200 }, (_, i) => ({ lat: 38.8 + i * 1e-4, lng: -77.2 }));
    const mins = await driveMatrixMinutes("KEY", { lat: 38.85, lng: -77.27 }, dests);
    expect(mins).toHaveLength(200);
    expect(mins.every((m) => m === 10)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
