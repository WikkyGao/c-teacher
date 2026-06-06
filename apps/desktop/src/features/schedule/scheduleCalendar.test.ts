import { describe, expect, it } from "vitest";
import { buildMonthCells, calendarTitle, shiftCalendarAnchor, visibleRangeForMode } from "./scheduleCalendar";

describe("scheduleCalendar", () => {
  it("builds a full month grid starting on Monday", () => {
    const cells = buildMonthCells(new Date("2026-06-15T12:00:00+08:00").getTime());

    expect(cells).toHaveLength(35);
    expect(cells[0]).toMatchObject({ key: "2026-06-01", dayNumber: 1, inCurrentMonth: true });
    expect(cells[34]).toMatchObject({ key: "2026-07-05", dayNumber: 5, inCurrentMonth: false });
  });

  it("returns visible ranges for month, week and day modes", () => {
    const anchor = new Date("2026-06-03T20:00:00+08:00").getTime();

    expect(visibleRangeForMode("week", anchor)).toMatchObject({
      start: new Date("2026-06-01T00:00:00+08:00").getTime(),
      end: new Date("2026-06-08T00:00:00+08:00").getTime()
    });
    expect(visibleRangeForMode("day", anchor)).toMatchObject({
      start: new Date("2026-06-03T00:00:00+08:00").getTime(),
      end: new Date("2026-06-04T00:00:00+08:00").getTime()
    });
    expect(visibleRangeForMode("month", anchor).start).toBe(new Date("2026-06-01T00:00:00+08:00").getTime());
  });

  it("shifts the calendar anchor by mode", () => {
    const anchor = new Date("2026-06-03T20:00:00+08:00").getTime();

    expect(calendarTitle("week", anchor)).toContain("06/01");
    expect(calendarTitle("day", anchor)).toContain("06/03");
    expect(new Date(shiftCalendarAnchor("day", anchor, 1)).getDate()).toBe(4);
    expect(new Date(shiftCalendarAnchor("week", anchor, 1)).getDate()).toBe(10);
    expect(new Date(shiftCalendarAnchor("month", anchor, 1)).getMonth()).toBe(6);
  });
});
