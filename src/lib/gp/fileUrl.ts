/**
 * Where the browser fetches a Guitar Pro file's bytes.
 *
 * Each path segment is encoded on its own, which is what every other
 * file-serving call site in this app does. `sanitizeName` on import strips
 * `<>:"/\|?*` but leaves `#` and `%` alone, and both wreck a bare template
 * string: `#` starts a fragment, so the request truncates and 404s, and a
 * stray `%` is an invalid escape. Either way the song imports cleanly and
 * then never plays.
 */
export function gpFileUrl(filePath: string): string {
  return `/api/gp/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}
