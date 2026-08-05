import { describe, it, expect } from "vitest";
import { matches } from "@/services/messaging/cron-parser";

describe("cron-parser matches()", () => {
  it("`* * * * *` matches any date", () => {
    expect(matches("* * * * *", new Date(2026, 0, 1, 0, 0))).toBe(true);
    expect(matches("* * * * *", new Date(2026, 6, 15, 14, 30))).toBe(true);
    expect(matches("* * * * *", new Date(2026, 11, 31, 23, 59))).toBe(true);
  });

  it("`0 8 * * *` matches 08:00 and not 09:00", () => {
    // 08:00 on a Wednesday
    expect(matches("0 8 * * *", new Date(2026, 7, 5, 8, 0))).toBe(true);
    // 09:00
    expect(matches("0 8 * * *", new Date(2026, 7, 5, 9, 0))).toBe(false);
    // 08:01
    expect(matches("0 8 * * *", new Date(2026, 7, 5, 8, 1))).toBe(false);
  });

  it("`0 8 * * 1,3,5` matches Mon/Wed/Fri at 08:00", () => {
    // 2026-08-03 is a Monday (getDay() === 1)
    expect(matches("0 8 * * 1,3,5", new Date(2026, 7, 3, 8, 0))).toBe(true);
    // 2026-08-05 is a Wednesday (getDay() === 3)
    expect(matches("0 8 * * 1,3,5", new Date(2026, 7, 5, 8, 0))).toBe(true);
    // 2026-08-07 is a Friday (getDay() === 5)
    expect(matches("0 8 * * 1,3,5", new Date(2026, 7, 7, 8, 0))).toBe(true);
    // 2026-08-04 is a Tuesday (getDay() === 2) -> no match
    expect(matches("0 8 * * 1,3,5", new Date(2026, 7, 4, 8, 0))).toBe(false);
    // 2026-08-06 is a Thursday (getDay() === 4) -> no match
    expect(matches("0 8 * * 1,3,5", new Date(2026, 7, 6, 8, 0))).toBe(false);
  });

  it("`30 9 * * *` matches 09:30 and not 09:29", () => {
    expect(matches("30 9 * * *", new Date(2026, 0, 1, 9, 30))).toBe(true);
    expect(matches("30 9 * * *", new Date(2026, 0, 1, 9, 29))).toBe(false);
    expect(matches("30 9 * * *", new Date(2026, 0, 1, 9, 31))).toBe(false);
  });

  it("`0 8 1 * *` matches the first of the month only", () => {
    // 1st of month at 08:00
    expect(matches("0 8 1 * *", new Date(2026, 0, 1, 8, 0))).toBe(true);
    // 2nd of month at 08:00
    expect(matches("0 8 1 * *", new Date(2026, 0, 2, 8, 0))).toBe(false);
    // 15th of month at 08:00
    expect(matches("0 8 1 * *", new Date(2026, 0, 15, 8, 0))).toBe(false);
  });

  it("`0 8 * * 1-5` matches weekdays only", () => {
    // 2026-08-03 Monday
    expect(matches("0 8 * * 1-5", new Date(2026, 7, 3, 8, 0))).toBe(true);
    // 2026-08-04 Tuesday
    expect(matches("0 8 * * 1-5", new Date(2026, 7, 4, 8, 0))).toBe(true);
    // 2026-08-05 Wednesday
    expect(matches("0 8 * * 1-5", new Date(2026, 7, 5, 8, 0))).toBe(true);
    // 2026-08-06 Thursday
    expect(matches("0 8 * * 1-5", new Date(2026, 7, 6, 8, 0))).toBe(true);
    // 2026-08-07 Friday
    expect(matches("0 8 * * 1-5", new Date(2026, 7, 7, 8, 0))).toBe(true);
    // 2026-08-08 Saturday (getDay() === 6)
    expect(matches("0 8 * * 1-5", new Date(2026, 7, 8, 8, 0))).toBe(false);
    // 2026-08-02 Sunday (getDay() === 0)
    expect(matches("0 8 * * 1-5", new Date(2026, 7, 2, 8, 0))).toBe(false);
  });
});
