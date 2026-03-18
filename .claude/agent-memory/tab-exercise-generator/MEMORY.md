# Tab Exercise Generator - Memory

## Lessons Learned
- `{tu 3}` must be on EVERY note in the triplet, not just the first
- Always use Python `r'''...'''` raw strings + `json.dumps` + `urllib` to POST AlphaTex (zsh `echo` corrupts `\t` → tab)
- Both hammer-ons (H) and pull-offs (P) use `{h}` in alphaTab AlphaTex
- DB column is `Book.name` not `Book.title`

## Successfully Generated Exercises
- **1-2-4 Spider** (Speed Mechanics / The Left Hand): ascending H-H across strings, descending P-P, shifting positions. 5 positions (1-2-4 through 5-6-8), 15 bars at 120 BPM.
- **1-3-2-4 Spider "4"** (Speed Mechanics / The Left Hand): 4-note pattern per string (1,3,2,4) ascending with H, descending (4,2,3,1) with P. 3 positions shifting up 1 fret each. 18 bars at 100 BPM, eighth notes.
- **1-4-3-2 Spider "5"** (Speed Mechanics / The Left Hand): 4-note pattern per string (1,4,3,2) ascending with H-P-P, descending (4,1,2,3) with P-H-H. 3 positions shifting up 1 fret each. 18 bars at 110 BPM, eighth notes.
