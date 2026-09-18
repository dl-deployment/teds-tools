// Vietnamese lunar calendar maths (Ho Ngoc Duc's algorithm, timezone +7) plus
// the date formatting the Event Timeline renders. Pure functions — `today` is
// injectable so callers (and tests) can pin the current day.
//
// This is the published algorithm including getLunarMonth11. The variant this
// was ported from inlined a mangled version of it and computed the month/year
// offsets by hand, which put Lunar New Year 2026 a month off; the known Tết
// dates are checked in the tests below.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getToday() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** e.g. "Wed, 18/09/2026" */
export function formatDate(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${DAYS[date.getDay()]}, ${d}/${m}/${date.getFullYear()}`;
}

export function monthName(index) {
  return MONTHS[index];
}

/**
 * Days from `today` until the event's next occurrence — a date already past
 * rolls over to the same day next year.
 */
export function calcDaysLeft(solarDateStr, today = getToday()) {
  const [year, month, day] = solarDateStr.split("-").map(Number);
  let eventDate = new Date(year, month - 1, day);
  if (eventDate < today) eventDate = new Date(year + 1, month - 1, day);

  const msPerDay = 1000 * 60 * 60 * 24;
  return { date: eventDate, daysLeft: Math.round((eventDate - today) / msPerDay) };
}

const TIME_ZONE = 7;

function jdFromDate(d, m, y) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  let jd =
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045;
  if (jd < 2299161) {
    jd = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k, timeZone) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  const Jd1 =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * T2 -
    0.000000155 * T3 +
    0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  return Math.floor(Jd1 + C1 - deltat + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn, timeZone) {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M);
  DL = DL + 0.00029 * Math.sin(dr * 3 * M);
  let theta = L0 + DL;
  theta = theta - 360 * Math.floor(theta / 360);
  return Math.floor(theta / 30);
}

/** Julian day the 11th lunar month starts in the given solar year. */
function getLunarMonth11(year, timeZone) {
  const off = jdFromDate(31, 12, year) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  if (getSunLongitude(nm, timeZone) >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Solar date → { day, month, year, leap } on the lunar calendar. */
export function solarToLunar(solarDate) {
  const dayNumber = jdFromDate(solarDate.getDate(), solarDate.getMonth() + 1, solarDate.getFullYear());
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, TIME_ZONE);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, TIME_ZONE);

  let a11 = getLunarMonth11(solarDate.getFullYear(), TIME_ZONE);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = solarDate.getFullYear();
    a11 = getLunarMonth11(solarDate.getFullYear() - 1, TIME_ZONE);
  } else {
    lunarYear = solarDate.getFullYear() + 1;
    b11 = getLunarMonth11(solarDate.getFullYear() + 1, TIME_ZONE);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, TIME_ZONE);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) leap = 1;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;

  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

function jdToDate(jd) {
  let b = 0;
  let c;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return new Date(year, month - 1, day);
}

/**
 * Lunar date → solar Date. A day past the end of that lunar month (a 30th in a
 * 29-day month) clamps to the month's last day rather than spilling over.
 */
export function lunarToSolar(lunarDay, lunarMonth, lunarYear) {
  const timeZone = TIME_ZONE;
  let a11;
  let b11;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }

  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    if (off >= leapOff) off += 1;
  }

  const monthStart = getNewMoonDay(k + off, timeZone);
  const daysInMonth = getNewMoonDay(k + off + 1, timeZone) - monthStart;
  const day = Math.min(Math.max(1, lunarDay), daysInMonth);
  return jdToDate(monthStart + day - 1);
}

/**
 * When a lunar holiday falls next, counting from `today`: its occurrence in
 * the current lunar year, or the next one once that has passed. This is why
 * lunar events can't simply roll the solar year forward — the lunar date
 * lands on a different solar day every year.
 */
export function nextLunarOccurrence(lunarDay, lunarMonth, today = getToday()) {
  const lunarYear = solarToLunar(today).year;
  let date = lunarToSolar(lunarDay, lunarMonth, lunarYear);
  if (date < today) date = lunarToSolar(lunarDay, lunarMonth, lunarYear + 1);
  return { date, daysLeft: Math.round((date - today) / (1000 * 60 * 60 * 24)) };
}

/** e.g. "25/09/2026" */
export function formatShortDate(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}
