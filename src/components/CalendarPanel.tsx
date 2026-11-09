import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import FullCalendar from "@fullcalendar/react";
import { useMemo, useState } from "react";
import { campsToTimedEvents, timeWindow } from "../lib/calendar";
import type { Camp } from "../lib/types";
import type { VenueStyle } from "../lib/venueStyle";

interface Props {
  camps: Camp[];
  initialDate: string;
  selectedVenue: string | null;
  onSelectCamp: (camp: Camp) => void;
  venueStyles: Map<string, VenueStyle>;
}

interface Range {
  start: string;
  end: string;
}

export function CalendarPanel({ camps, initialDate, selectedVenue, onSelectCamp, venueStyles }: Props) {
  const physical = useMemo(() => camps.filter((c) => !c.isVirtual), [camps]);
  const { slotMinTime, slotMaxTime } = useMemo(() => timeWindow(physical), [physical]);
  const [range, setRange] = useState<Range | null>(null);

  const events = useMemo<EventInput[]>(() => {
    // Every view uses actual occurrences and times, scoped to the visible range.
    const base = range ? campsToTimedEvents(physical, range.start, range.end) : [];

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
          right: "timeGridDay,timeGridWeek,dayGridWeek,dayGridMonth,listWeek",
        }}
        buttonText={{
          timeGridDay: "day",
          timeGridWeek: "week (hours)",
          dayGridWeek: "week",
          dayGridMonth: "month",
          listWeek: "list",
        }}
        events={events}
        displayEventEnd
        height="auto"
        dayMaxEvents={6}
        firstDay={0}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        nowIndicator={false}
        datesSet={(arg: DatesSetArg) =>
          setRange({
            start: arg.startStr.slice(0, 10),
            end: arg.endStr.slice(0, 10),
          })
        }
        eventClick={(arg: EventClickArg) => {
          onSelectCamp(arg.event.extendedProps.camp as Camp);
        }}
      />
    </div>
  );
}
