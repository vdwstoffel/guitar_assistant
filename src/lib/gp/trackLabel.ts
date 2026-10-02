/**
 * Readable labels for a Guitar Pro file's tracks, computed against the whole
 * list so that no two come out the same.
 *
 * Guitar Pro names a track by piling up who plays it, what they play it on,
 * and only then what it IS — `Kerry King | ESP "Kerry King" Explorer Custom
 * | Lead Guitar - Distortion Guitar`. In a narrow control that truncates
 * from the left, throwing away the only part that distinguishes it: a
 * six-track file showed two mixer rows both reading `Kerry King | ESP "Kerry
 * King" Explorer Custo…`, one the clean guitar and one the lead.
 *
 * So the instrument leads. But the instrument alone is not always unique
 * either — on the same file Jeff Hanneman and Kerry King both play "Lead
 * Guitar - Distortion Guitar", and dropping the player made those two
 * identical instead. Hence the list: a label is shortened only as far as it
 * can go while staying distinct, and the tracks that are unambiguous do not
 * pay for the ones that are not.
 *
 * The full name stays available as a tooltip wherever these are used.
 */
function segments(name: string): string[] {
  return name.split("|").map((p) => p.trim()).filter(Boolean);
}

export function trackLabels(names: string[]): string[] {
  const instrument = names.map((name) => {
    const parts = segments(name);
    return parts.length > 0 ? parts[parts.length - 1] : name;
  });

  const seen = new Map<string, number>();
  for (const label of instrument) seen.set(label, (seen.get(label) ?? 0) + 1);

  return names.map((name, i) => {
    if ((seen.get(instrument[i]) ?? 0) === 1) return instrument[i];

    // Ambiguous: bring back who plays it.
    const parts = segments(name);
    if (parts.length < 2) return name;
    const withPlayer = `${parts[0]} — ${instrument[i]}`;

    // Still ambiguous — two tracks by one player on the same instrument —
    // so nothing short of the whole name separates them.
    const clashes = names.filter((other, j) => {
      if (j === i) return false;
      const otherParts = segments(other);
      return otherParts.length >= 2 && `${otherParts[0]} — ${instrument[j]}` === withPlayer;
    });
    return clashes.length > 0 ? name : withPlayer;
  });
}
