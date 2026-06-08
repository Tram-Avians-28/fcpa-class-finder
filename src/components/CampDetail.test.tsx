import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Camp } from "../lib/types";
import { CampDetail } from "./CampDetail";

const camp: Camp = {
  title: "Softball Camp with US9",
  category: "SPORTS",
  catalogId: "6J2.B9BH",
  community: "Annandale",
  venue: "Audrey Moore Rec Center", // green phase
  fee: 139,
  startDate: "2026-07-06",
  endDate: "2026-07-10",
  startTime: "09:00",
  endTime: "16:00",
  ageMin: 7,
  ageMax: 13,
  weekLabel: "Week 3 (July 6-10)",
  status: "Available as of 5.15.2026",
  isVirtual: false,
  driveMinutes: 21,
};

describe("CampDetail", () => {
  it("shows the camp's key details", () => {
    render(<CampDetail camp={camp} onClose={() => {}} inShortlist={false} onToggleShortlist={() => {}} />);
    expect(screen.getByText("Softball Camp with US9")).toBeInTheDocument();
    expect(screen.getByText("6J2.B9BH")).toBeInTheDocument();
    expect(screen.getByText(/Audrey Moore Rec Center/)).toBeInTheDocument();
    expect(screen.getByText(/\$139/)).toBeInTheDocument();
    expect(screen.getByText(/~21 min/)).toBeInTheDocument();
    expect(screen.getByText(/Green/)).toBeInTheDocument(); // registration phase
  });

  it("toggles the shortlist", () => {
    const onToggle = vi.fn();
    render(<CampDetail camp={camp} onClose={() => {}} inShortlist={false} onToggleShortlist={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /add to shortlist/i }));
    expect(onToggle).toHaveBeenCalledWith("6J2.B9BH");
  });

  it("shows remove label when already shortlisted, and closes", () => {
    const onClose = vi.fn();
    render(<CampDetail camp={camp} onClose={onClose} inShortlist onToggleShortlist={() => {}} />);
    expect(screen.getByRole("button", { name: /remove from shortlist/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
