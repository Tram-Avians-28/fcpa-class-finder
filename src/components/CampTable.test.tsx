import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Camp } from "../lib/types";
import { CampTable } from "./CampTable";

function camp(o: Partial<Camp> = {}): Camp {
  return {
    title: "Camp",
    category: "SPORTS",
    catalogId: "X.1",
    community: "Annandale",
    venue: "Audrey Moore Rec Center",
    fee: 100,
    startDate: "2026-07-06",
    endDate: "2026-07-10",
    startTime: "09:00",
    endTime: "16:00",
    ageMin: 6,
    ageMax: 13,
    weekLabel: "Week 3",
    status: "",
    isVirtual: false,
    ...o,
  };
}

const camps = [
  camp({ catalogId: "a", title: "Soccer Stars" }),
  camp({ catalogId: "b", title: "LEGO Robotics" }),
  camp({ catalogId: "c", title: "Soccer Skills" }),
];

const noop = () => {};

describe("CampTable filtering", () => {
  it("narrows rows via a column filter", () => {
    const { container } = render(
      <CampTable camps={camps} shortlist={new Set()} onToggleShortlist={noop} filterable />,
    );
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    fireEvent.change(screen.getAllByPlaceholderText("filter")[0], { target: { value: "soccer" } });
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("renders no filter controls when not filterable", () => {
    render(<CampTable camps={camps} shortlist={new Set()} onToggleShortlist={noop} />);
    expect(screen.queryByPlaceholderText("filter")).toBeNull();
  });

  it("opens the camp detail when a row is clicked, but not when the star is clicked", () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    render(
      <CampTable
        camps={camps}
        shortlist={new Set()}
        onToggleShortlist={onToggle}
        onSelectCamp={onSelect}
      />,
    );
    // Click the star -> toggles shortlist, does NOT open detail.
    fireEvent.click(screen.getAllByRole("button", { name: /add to shortlist/i })[0]);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    // Click a cell in the row -> opens detail.
    fireEvent.click(screen.getByText("Soccer Stars"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ catalogId: "a" }));
  });

  it("sorts when a header is clicked", () => {
    const { container } = render(
      <CampTable camps={camps} shortlist={new Set()} onToggleShortlist={noop} filterable />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Camp/ }));
    const first = container.querySelector("tbody tr td:nth-child(2)")?.textContent;
    expect(first).toBe("LEGO Robotics"); // alphabetical ascending
  });
});
