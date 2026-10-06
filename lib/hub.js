/**
 * Pure helpers for the bundled Notes and Links defaults.
 *
 * Both sections' starter data lives in `public/hub/` as a plain list, so adding
 * a default note or link is a JSON edit rather than a code change — the same
 * arrangement the POE trade files use. Each tab's Export .json writes its list
 * back out through `buildNotesFile` / `buildLinksFile` in exactly the shape the
 * file carries, so a download can replace the bundled file as it stands.
 *
 * Ids and dates are deliberately not part of the file: the data layer stamps
 * `cryptoId()` and `todayStr()` on each seeded row, the way it does for the
 * bundled trade payloads, so a file never carries two rows with the same id and
 * no date is frozen into it.
 */

export const NOTES_FILE = "notes.json";
export const LINKS_FILE = "links.json";

export const NOTES_URL = `/hub/${NOTES_FILE}`;
export const LINKS_URL = `/hub/${LINKS_FILE}`;

function requiredString(value, at, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${at} has no ${field}.`);
  return value;
}

/** An optional text field reads as empty rather than being dropped. */
function optionalString(value) {
  return typeof value === "string" ? value : "";
}

/**
 * The bundled notes file (public/hub/notes.json) is a list of
 * `{ title, body?, tag? }`. Throws on the first bad entry rather than returning
 * a partial list, matching `parseBundledPayloads` in lib/poe.js; the seed treats
 * a throw as a failed load and leaves its flag unset so a later load retries.
 *
 * An empty list is allowed and simply seeds nothing — unlike the payload file, a
 * hub with no default notes is a real state rather than a broken file.
 */
export function parseBundledNotes(data) {
  if (!Array.isArray(data)) throw new Error("Expected a list of notes.");

  return data.map((note, i) => {
    const at = `Note ${i + 1}`;
    if (!note || typeof note !== "object" || Array.isArray(note)) {
      throw new Error(`${at} is not an object.`);
    }
    return {
      title: requiredString(note.title, at, "title"),
      body: optionalString(note.body),
      tag: optionalString(note.tag),
    };
  });
}

/**
 * The bundled links file (public/hub/links.json) is a list of `{ name, url }`,
 * validated the same way as the notes file. `url` is kept as typed — https:// is
 * assumed at render time when it is missing (see app/links/page.js).
 */
export function parseBundledLinks(data) {
  if (!Array.isArray(data)) throw new Error("Expected a list of links.");

  return data.map((link, i) => {
    const at = `Link ${i + 1}`;
    if (!link || typeof link !== "object" || Array.isArray(link)) {
      throw new Error(`${at} is not an object.`);
    }
    return {
      name: requiredString(link.name, at, "name"),
      url: requiredString(link.url, at, "url"),
    };
  });
}

/** The notes in that file's shape, so a download can replace it. */
export function buildNotesFile(notes) {
  return (notes || []).map((note) => ({
    title: note.title,
    body: note.body || "",
    tag: note.tag || "",
  }));
}

/** The links in that file's shape, so a download can replace it. */
export function buildLinksFile(links) {
  return (links || []).map((link) => ({ name: link.name, url: link.url }));
}
