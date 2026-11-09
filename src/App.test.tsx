import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeView, readSharedFromHash } from "./lib/shareState";
import type { Camp } from "./lib/types";

// Each test starts with no cached dataset so the app shows the upload prompt.
beforeEach(() => localStorage.clear());
afterEach(() => history.replaceState(null, "", location.pathname));

// Leaflet + FullCalendar need real layout/canvas that jsdom lacks; stub them so
// this test can exercise the upload -> parse -> enrich -> filter -> render flow.
vi.mock("./components/MapPanel", () => ({
  MapPanel: ({ camps }: { camps: Camp[] }) => <div data-testid="map" data-count={camps.length} />,
}));
vi.mock("./components/CalendarPanel", () => ({
  CalendarPanel: ({ camps }: { camps: Camp[] }) => <div data-testid="calendar" data-count={camps.length} />,
}));

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

async function uploadSearchCatalog(container: HTMLElement) {
  const activities = [
    { title: "Swimming Basics", catalogId: "swim", category: "SPORTS" },
    { title: "Creative Studio", catalogId: "art", category: "ART", description: "Explore painting and clay." },
    { title: "Soccer Skills", catalogId: "soccer", category: "SPORTS" },
    { title: "Online Painting", catalogId: "virtual", category: "ART", isVirtual: true },
  ].map((activity) => ({
    startDate: "2026-07-06", endDate: "2026-07-10", venue: "Audrey Moore Rec Center", ...activity,
  }));
  const bytes = new TextEncoder().encode(JSON.stringify({ activities }));
  const file = new File([bytes], "search-catalog.json", { type: "application/json" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
  await screen.findByText(/of 4 activities/);
}

describe("App integration", () => {
  it("starts with all categories selected, supports toggling all, and resets virtual and category choices", async () => {
    const { container } = render(<App />);
    await uploadSearchCatalog(container);
    const categories = within(screen.getByRole("group", { name: "Categories" }));
    const virtual = screen.getByRole("checkbox", { name: "Include virtual activities" });
    for (const checkbox of categories.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    expect(virtual).not.toBeChecked();
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();

    fireEvent.click(categories.getByRole("checkbox", { name: "SPORTS" }));
    expect(screen.getByText(/1 of 4 activities/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check all categories" }));
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Uncheck all categories" }));
    for (const checkbox of categories.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/0 of 4 activities/)).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-count", "0");
    expect(screen.getByTestId("calendar")).toHaveAttribute("data-count", "0");

    fireEvent.click(screen.getByRole("button", { name: "Check all categories" }));
    fireEvent.click(virtual);
    expect(screen.getByText(/4 of 4 activities/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Uncheck all categories" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    for (const checkbox of categories.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    expect(virtual).not.toBeChecked();
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();
  });

  it("applies submitted title/description searches across views, shares the applied query, and clears on reset", async () => {
    const { container } = render(<App />);
    await uploadSearchCatalog(container);
    const search = screen.getByRole("searchbox", { name: "Title or description" });
    fireEvent.change(search, { target: { value: "SWIMMING painting" } });
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByText(/2 of 4 activities/)).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-count", "2");
    expect(screen.getByTestId("calendar")).toHaveAttribute("data-count", "2");
    fireEvent.click(screen.getByRole("button", { name: /^List/ }));
    expect(screen.getByText("Swimming Basics")).toBeInTheDocument();
    expect(screen.getByText("Creative Studio")).toBeInTheDocument();
    expect(screen.queryByText("Soccer Skills")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "soccer" } });
    fireEvent.click(screen.getByRole("button", { name: "Share view" }));
    await waitFor(() => expect(readSharedFromHash()?.c.searchText).toBe("SWIMMING painting"));
    // Native form submission also handles Enter from the search input.
    fireEvent.submit(search.closest("form")!);
    expect(screen.getByText(/1 of 4 activities/)).toBeInTheDocument();
    expect(screen.getByText("Soccer Skills")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "painting" } });
    fireEvent.submit(search.closest("form")!);
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(search).toHaveValue("");
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();
    // Reset also clears a draft that has never been applied.
    fireEvent.change(search, { target: { value: "unsubmitted" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(search).toHaveValue("");
  });

  it("applies phrases and exclusions only on submission and shares the original query", async () => {
    const { container } = render(<App />);
    await uploadSearchCatalog(container);
    const search = screen.getByRole("searchbox", { name: "Title or description" });
    const query = '“swimming basics” "soccer skills" -soccer';
    fireEvent.change(search, { target: { value: query } });
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();
    fireEvent.submit(search.closest("form")!);
    expect(screen.getByText(/1 of 4 activities/)).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-count", "1");
    expect(screen.getByTestId("calendar")).toHaveAttribute("data-count", "1");
    fireEvent.click(screen.getByRole("button", { name: /^List/ }));
    expect(screen.getByText("Swimming Basics")).toBeInTheDocument();
    expect(screen.queryByText("Soccer Skills")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share view" }));
    await waitFor(() => expect(readSharedFromHash()?.c.searchText).toBe(query));

    fireEvent.change(search, { target: { value: '"painting and" -clay' } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByText(/0 of 4 activities/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText(/3 of 4 activities/)).toBeInTheDocument();
  });

  it("restores a shared search, virtual opt-in, and empty category selection", async () => {
    history.replaceState(null, "", `#share=${encodeView({
      c: { searchText: '"painting" -swimming', includeVirtual: true, categories: [] }, t: "list", sv: null, sl: [],
    })}`);
    const { container } = render(<App />);
    await uploadSearchCatalog(container);
    expect(screen.getByRole("searchbox", { name: "Title or description" })).toHaveValue('"painting" -swimming');
    expect(screen.getByRole("checkbox", { name: "Include virtual activities" })).toBeChecked();
    expect(screen.getByText(/0 of 4 activities/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check all categories" }));
    expect(screen.getByText(/2 of 4 activities/)).toBeInTheDocument();
    expect(screen.getByText("Creative Studio")).toBeInTheDocument();
    expect(screen.getByText("Online Painting")).toBeInTheDocument();
  });

  it("uploads, parses, and renders activities end-to-end", async () => {
    const { container } = render(<App />);
    expect(screen.getByText(/Get started/)).toBeInTheDocument();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fixtureFile()] } });

    // Status bar reflects the parsed catalog.
    await waitFor(() => expect(screen.getByText(/of 2151 activities/)).toBeInTheDocument(), {
      timeout: 5000,
    });

    // Default view mounts the (stubbed) map + calendar together.
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getByTestId("calendar")).toBeInTheDocument();

    // The List tab renders one row per currently visible camp. The exact count
    // changes with today's date because the default filter hides past sessions.
    fireEvent.click(screen.getByRole("button", { name: /^List/ }));
    const rows = await screen.findAllByRole("row");
    const status = screen.getByText(/of 2151 activities/).textContent ?? "";
    const shown = Number(status.match(/· (\d+) of/)?.[1]);
    expect(shown).toBeGreaterThan(0);
    expect(rows).toHaveLength(shown + 1); // one header row
  });

  it("adds a camp to the shortlist and shows it under the Shortlist tab", async () => {
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fixtureFile()] } });
    await waitFor(() => expect(screen.getByText(/of 2151 activities/)).toBeInTheDocument(), {
      timeout: 5000,
    });

    fireEvent.click(screen.getByRole("button", { name: /^List/ }));
    const firstStar = (await screen.findAllByRole("button", { name: /add to shortlist/i }))[0];
    fireEvent.click(firstStar);

    fireEvent.click(screen.getByRole("button", { name: /^Shortlist/ }));
    expect(screen.getByText(/My FCPA Activity Shortlist/)).toBeInTheDocument();
    // Shortlist table = header row + the one picked camp.
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("applies the max-fee filter to the rendered list", async () => {
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fixtureFile()] } });
    await waitFor(() => expect(screen.getByText(/of 2151 activities/)).toBeInTheDocument(), {
      timeout: 5000,
    });

    const feeInput = container.querySelector('input[placeholder^="up to"]') as HTMLInputElement;
    fireEvent.change(feeInput, { target: { value: "40" } });

    await waitFor(() => {
      const m = screen.getByText(/of 2151 activities/).textContent ?? "";
      const shown = Number(m.match(/· (\d+) of/)?.[1]);
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(2151);
    });
  });
});
