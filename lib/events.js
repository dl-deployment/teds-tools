// Static event list for the Event Timeline tool — reference data, not user
// data, so it lives here rather than in useHubData's localStorage blob. Edit
// this array to add an event.
//
// `type: "lunar"` events are scheduled by their `lunarDate` ("dd/mm"), because
// that date lands on a different solar day each year; their `solarDate` is only
// a fallback for when `lunarDate` is missing. `type: "solar"` events are fixed
// Gregorian dates and use `solarDate` directly.

import { calcDaysLeft, getToday, nextLunarOccurrence } from "./lunar.js";

export const events = [
  { name: "Tết Nguyên Đán", solarDate: "2026-02-17", lunarDate: "01/01", type: "lunar", icon: "🎆", note: "Lunar New Year" },
  { name: "Ngày Thần Tài", solarDate: "2026-02-27", lunarDate: "10/01", type: "lunar", icon: "💰", note: "God of Wealth day" },
  { name: "Rằm Tháng Giêng", solarDate: "2026-03-03", lunarDate: "15/01", type: "lunar", icon: "🌕", note: "First full moon" },
  { name: "Giỗ Tổ Hùng Vương", solarDate: "2026-04-27", lunarDate: "10/03", type: "lunar", icon: "🏯", note: "Hung Kings' commemoration" },
  { name: "Ngày Thống Nhất", solarDate: "2026-04-30", lunarDate: "", type: "solar", icon: "🇻🇳", note: "Reunification Day" },
  { name: "Ngày Quốc Tế Lao Động", solarDate: "2026-05-01", lunarDate: "", type: "solar", icon: "🛠️", note: "Labour Day" },
  { name: "Tết Đoan Ngọ", solarDate: "2026-06-19", lunarDate: "05/05", type: "lunar", icon: "🍑", note: "Mid-year festival" },
  { name: "Ngày Quốc Khánh", solarDate: "2026-09-02", lunarDate: "", type: "solar", icon: "🎗️", note: "National Day" },
  { name: "Trung Thu", solarDate: "2026-09-24", lunarDate: "15/08", type: "lunar", icon: "🥮", note: "Mid-Autumn festival" },
  { name: "Halloween", solarDate: "2026-10-31", lunarDate: "", type: "solar", icon: "🎃", note: "31/10" },
  { name: "Giáng Sinh", solarDate: "2026-12-25", lunarDate: "", type: "solar", icon: "🎄", note: "Merry Christmas" },
  { name: "Giao Thừa Tết 2027", solarDate: "2027-02-05", lunarDate: "30/12", type: "lunar", icon: "🧨", note: "New Year's Eve" },
];

/** When this event next falls, from `today`. */
export function nextOccurrence(ev, today = getToday()) {
  if (ev.type === "lunar" && ev.lunarDate) {
    const [day, month] = ev.lunarDate.split("/").map(Number);
    if (day > 0 && month > 0) return nextLunarOccurrence(day, month, today);
  }
  return calcDaysLeft(ev.solarDate, today);
}

/** Attach each event's next occurrence and days remaining, soonest first. */
export function processEvents(rawEvents = events, today = getToday()) {
  return rawEvents
    .map((ev) => {
      const { date, daysLeft } = nextOccurrence(ev, today);
      return { ...ev, eventDate: date, daysLeft };
    })
    .sort((a, b) => a.eventDate - b.eventDate);
}
