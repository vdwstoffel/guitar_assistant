# Songsterr → alphaTab converter (vendored)

Ported verbatim from [songsterr-downloader](https://github.com/Metaphysics0/songsterr-downloader)
(MIT, Copyright 2026 Ryan Roberts — see `LICENSE`). This directory is
third-party code: **change it only to track upstream**, so a future
re-port stays a diff rather than a merge.

What it does: turns Songsterr's per-part revision JSON into a Guitar Pro 7
file, by building an alphaTab `Score` and running alphaTab's `Gp7Exporter`
over it. The two `gp7-*-patch.ts` files fix up the exporter's output
afterwards, for drum staves and for harmonics, which GP7 encodes
differently from the way alphaTab writes them.

Local changes to the upstream sources, kept to the minimum:

- `$lib/types` (a SvelteKit alias) → `./types`, which is upstream's
  `src/lib/types/index.ts` copied in unchanged.
- The two `full song conversion` blocks are dropped from the test file.
  They read real Songsterr tab data from upstream's `test-data/`, which is
  copyrighted transcription and does not belong in this repo. The other 22
  blocks build their payloads inline and are ported as-is.

Everything that *fetches* from Songsterr is ours and lives one level up in
`src/lib/songsterr/` — upstream's fetch layer is wrapped in SvelteKit
logger and fetcher abstractions that would not have earned their keep here.
