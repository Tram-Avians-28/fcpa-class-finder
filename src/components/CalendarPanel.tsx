import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import FullCalendar from "@fullcalendar/react";
import { useMemo, useState } from "react";
import { campsToEvents, campsToTimedEvents, timeWindow } from "../lib/calendar";
import type { Camp } from "../lib/types";
import type { VenueStyle } from "../lib/venueStyle";

interface Props {
  camps: Camp[];
  initialDate: string;
  selectedVenue: string | null;
  onSelectVenue: (venue: string | null) => void;
  venueStyles: Map<string, VenueStyle>;
}

interface Range {
  start: string;
  end: string;
  type: string;
}

export function CalendarPanel({ camps, initialDate, selectedVenue, onSelectVenue, venueStyles }: Props) {
  const physical = useMemo(() => camps.filter((c) => !c.isVirtual), [camps]);
  const { slotMinTime, slotMaxTime } = useMemo(() => timeWindow(physical), [physical]);
  const [range, setRange] = useState<Range | null>(null);

  const events = useMemo<EventInput[]>(() => {
    // Time-grid views need per-day timed events (scoped to the visible range for
    // performance); other views use all-day multi-day blocks.
    const base =
      range && range.type.startsWith("timeGrid")
        ? campsToTimedEvents(physical, range.start, range.end)
        : campsToEvents(physical);

    return base.map((e) => {
      const st = venueStyles.get(e.extendedProps.camp.venue);
      const selected = selectedVenue != null && e.extendedProps.camp.venue === selectedVenue;
      const classNames: string[] = [];
      if (st) classNames.push(`pat-${st.pattern}`);
      if (selected) classNames.push("sel-event");
      return {
        ...e,
        backgroundColor: st?.color ?? "#3788d8",
        borderColor: st?.color ?? "#3788d8",
        classNames,
      };
    });
  }, [physical, range, venueStyles, selectedVenue]);

  return (
    <div className="cal-wrap">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        initialView="dayGridWeek"
        initialDate={initialDate}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,dayGridWeek,dayGridMonth,listWeek",
        }}
        buttonText={{ timeGridWeek: "week (hours)", dayGridWeek: "week", dayGridMonth: "month", listWeek: "list" }}
        events={events}
        height="auto"
        dayMaxEvents={6}
        firstDay={0}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        expandRows
        nowIndicator={false}
        datesSet={(arg: DatesSetArg) =>
          setRange({
            start: arg.startStr.slice(0, 10),
            end: arg.endStr.slice(0, 10),
            type: arg.view.type,
          })
        }
        eventClick={(arg: EventClickArg) => {
          const c = arg.event.extendedProps.camp as Camp;
          onSelectVenue(c.venue === selectedVenue ? null : c.venue);
        }}
      />
    </div>
  );
}
