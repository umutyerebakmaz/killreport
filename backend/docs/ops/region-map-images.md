# Region map images

Every region has a star map thumbnail at
`frontend/public/images/regions/{region_id}.svg`. They are generated from our
own topology data, committed to the repository, and served by Next as static
files. Nothing renders at request time.

## When to run it

After an SDE update — that is, after `queue:regions`, `queue:constellations`,
`queue:solar-systems` or `worker-stargates` have changed the topology. Not on a
schedule: this is static universe data, and per the project's rule only mutable
data gets scheduled.

```bash
yarn workspace backend render:region-maps
```

Expected output today:

```
114 regions written to .../frontend/public/images/regions
  8490 systems, 6619 internal jumps, 740 outbound gates
  0 stale files removed
```

Then commit whatever changed. The diff is the record of what the SDE update
did to the map — that is the reason these live in git rather than in object
storage.

The run also deletes any `.svg` in the directory whose region no longer exists,
so a retired or renumbered region cannot leave a stale (or wrong) map behind;
expect `0 stale files removed` on an ordinary run and check the diff if that
number is not zero.

## What it draws

- One dot per system, `r 1.3`, coloured on EVE's own security ramp
  (`#2FEFEF` at 1.0 down to `#F00000` at 0.0 and below).
- One neutral line per stargate jump inside the region.
- A 10-unit green stub for each gate leaving the region. Stubs are allowed to
  run past the frame and be clipped — 690 of the 740 clear it whole.
- Transparent background. The site has a single dark theme and the image sits
  on three different surfaces, one of which changes on hover
  (`.card-row` in `cards.css`), so a baked-in background would leave a dark
  square behind.

The drawing itself is in [`../../src/scripts/region-map-svg.ts`](../../src/scripts/region-map-svg.ts),
which knows nothing about the database and is covered by unit tests. The script
that queries and writes is
[`../../src/scripts/render-region-maps.ts`](../../src/scripts/render-region-maps.ts).

## Sizes

There is one file per region and it is used at every size — 20px in a line of
text, 64px in a list row, 256px in a page header (96px below the `sm`
breakpoint). An SVG has no resolution, so there is nothing to export at 2x and
no `srcset`.

What does change with size is line weight: everything scales together, so at
64px the `w 0.75` jump line lands at about 0.4 of a pixel and reads faint. If that
turns out too weak in place, raise `JUMP_WIDTH` in `region-map-svg.ts` and
re-run — it is one number and 114 files.

## Regions with nothing to draw

- 46 regions, all wormhole and abyssal space, have no stargate connections.
  They render as dots only. That is correct: those regions genuinely have no
  gate topology.
- 48 regions have no gates leaving them, so they carry no green.
- 3 regions hold a single system (G-R00031, GPMR-01, Yasna Zakh): two render as
  a dot, and Yasna Zakh renders as a dot with four green stubs.

None of these get a substitute image.
