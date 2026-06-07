import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Each test starts with no cached dataset so the app shows the upload prompt.
beforeEach(() => localStorage.clear());

// Leaflet + FullCalendar need real layout/canvas that jsdom lacks; stub them so
// this test can exercise the upload -> parse -> enrich -> filter -> render flow.
vi.mock("./components/MapPanel", () => ({ MapPanel: () => <div data-testid="map" /> }));
vi.mock("./components/CalendarPanel", () => ({ CalendarPanel: () => <div data-testid="calendar" /> }));

import App from "./App";

function fixtureFile(): File {
  const bytes = readFileSync(resolve(process.cwd(), "src/test/fixtures/fcpa-camp-spreadsheet.xlsx"));
  const file = new File([bytes], "fcpa-camp-spreadsheet.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  // jsdom's File doesn't implement arrayBuffer(); browsers do. Provide it.
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new Uint8Array(bytes).buffer,
  });
  return file;
}

describe("App integration", () => {
  it("uploads, parses, and renders camps end-to-end", async () => {
    const { container } = render(<App />);
    expect(screen.getByText(/Get started/)).toBeInTheDocument();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fixtureFile()] } });

    // Status bar reflects the parsed catalog.
    await waitFor(() => expect(screen.getByText(/of 2151 camps/)).toBeInTheDocument(), {
      timeout: 5000,
    });

    // Default view mounts the (stubbed) map + calendar together.
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getByTestId("calendar")).toBeInTheDocument();

    // The List tab renders a row per camp.
    fireEvent.click(screen.getByRole("button", { name: /^List/ }));
    const rows = await screen.findAllByRole("row");
    expect(rows.length).toBeGreaterThan(1000);
  });

  it("adds a camp to the shortlist and shows it under the Shortlist tab", async () => {
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fixtureFile()] } });
    await waitFor(() => expect(screen.getByText(/of 2151 camps/)).toBeInTheDocument(), {
      timeout: 5000,
    });

    fireEvent.click(screen.getByRole("button", { name: /^List/ }));
    const firstStar = (await screen.findAllByRole("button", { name: /add to shortlist/i }))[0];
    fireEvent.click(firstStar);

    fireEvent.click(screen.getByRole("button", { name: /^Shortlist/ }));
    expect(screen.getByText(/My FCPA Camp Shortlist/)).toBeInTheDocument();
    // Shortlist table = header row + the one picked camp.
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("applies the max-fee filter to the rendered list", async () => {
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fixtureFile()] } });
    await waitFor(() => expect(screen.getByText(/of 2151 camps/)).toBeInTheDocument(), {
      timeout: 5000,
    });

    const feeInput = container.querySelector('input[placeholder^="up to"]') as HTMLInputElement;
    fireEvent.change(feeInput, { target: { value: "40" } });

    await waitFor(() => {
      const m = screen.getByText(/of 2151 camps/).textContent ?? "";
      const shown = Number(m.match(/· (\d+) of/)?.[1]);
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(2151);
    });
  });
});
