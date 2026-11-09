import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Camp } from "../lib/types";
import { CalendarPanel } from "./CalendarPanel";

const activity: Camp = {
  title: "Aerobic Water Exercise (13-Adult)",
  category: "AQUATICS",
  catalogId: "3AD.Q3CK",
  community: "Springfield",
  venue: "South Run Rec Center",
  fee: null,
  startDate: "2026-10-26",
  endDate: "2026-12-18",
  startTime: "09:00",
  endTime: "09:55",
  meetingDays: [1, 3, 5],
  ageMin: 13,
  ageMax: null,
  weekLabel: "",
  status: "",
  isVirtual: false,
};

describe("CalendarPanel recurrence", () => {
  it("shows actual dates and time ranges in week, list, month and hourly views", async () => {
    const onSelectCamp = vi.fn();
    const { container } = render(
      <CalendarPanel
        camps={[activity]}
        initialDate="2026-11-08"
        selectedVenue={null}
        onSelectCamp={onSelectCamp}
        venueStyles={new Map()}
      />,
    );
    const eventDays = () => Array.from(container.querySelectorAll(".fc-daygrid-day"))
      .filter((day) => day.querySelector(".fc-event"))
      .map((day) => day.getAttribute("data-date"));

    await waitFor(() => expect(eventDays()).toEqual(["2026-11-09", "2026-11-11", "2026-11-13"]));
    fireEvent.click(container.querySelector(".fc-event")!);
    expect(onSelectCamp).toHaveBeenCalledWith(activity);

    fireEvent.click(screen.getByText("list", { selector: "button" }));
    await waitFor(() => expect(container.querySelectorAll(".fc-list-event")).toHaveLength(3));
    for (const cell of container.querySelectorAll(".fc-list-event-time")) {
      expect(cell.textContent).toContain("9:00");
      expect(cell.textContent).toContain("9:55");
      expect(cell.textContent).not.toMatch(/all.day/i);
    }

    fireEvent.click(screen.getByText("month", { selector: "button" }));
    await waitFor(() => expect(eventDays().length).toBeGreaterThan(3));
    expect(eventDays().every((day) => [1, 3, 5].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))).toBe(true);

    fireEvent.click(screen.getByText("week (hours)", { selector: "button" }));
    await waitFor(() => expect(container.querySelectorAll(".fc-timegrid-event")).toHaveLength(3));
  });
});
