# Star map images

Every region and every constellation has a star map thumbnail:

|                | Path                                                           | Count |
| -------------- | -------------------------------------------------------------- | ----: |
| Regions        | `frontend/public/images/regions/{region_id}.svg`               |   114 |
| Constellations | `frontend/public/images/constellations/{constellation_id}.svg` | 1.184 |

They are generated from our own topology data, committed to the repository, and
served by Next as static files. Nothing renders at request time.

## When to run it

After an SDE update — that is, after `queue:regions`, `queue:constellations`,
`queue:solar-systems` or `worker-stargates` have changed the topology. Not on a
schedule: this is static universe data, and per the project's rule only mutable
data gets scheduled.

```bash
yarn workspace backend render:maps
```

`render:maps` runs both renderers. Run them separately —
`render:region-maps`, `render:constellation-maps` — only when you have a reason
to; refreshing one set and leaving the other behind means the two are drawn
from different topology.

Expected output today:

```
114 regions written to .../frontend/public/images/regions
  8490 systems, 6619 internal jumps, 740 outbound gates
  0 stale files removed
1184 constellations written to .../frontend/public/images/constellations
  8490 systems, 5704 internal jumps, 2570 outbound gates
  0 stale files removed
```

Then commit whatever changed. The diff is the record of what the SDE update
did to the map — that is the reason these live in git rather than in object
storage. The whole constellation set is 1,40 MB across 1.184 files, about
1.240 bytes each, so it costs roughly what the 114 region files already do.

Each run also deletes any `.svg` in its directory whose region or constellation
no longer exists, so a retired or renumbered one cannot leave a stale (or
wrong) map behind; expect `0 stale files removed` on an ordinary run and check
the diff if that number is not zero. Reconciliation refuses to run at all when
it would remove more than a quarter of the files on disk — that shape is an
incomplete query, not an SDE retirement, and it matters most for the 1.184
constellation files.

## What it draws

Both maps share every line of geometry: `x` becomes screen x, `−z` becomes
screen y, the long axis is normalised to 0–100, each jump is drawn once, and
outbound stubs run 10 units towards their destination and are allowed to clip.
Only the palette differs.

### Regions

- One dot per system, `r 1.3`, coloured on EVE's own security ramp
  (`#2FEFEF` at 1.0 down to `#F00000` at 0.0 and below).
- One neutral `#94a3b8` line per stargate jump inside the region.
- A 10-unit green `#4CC94C` stub for each gate leaving the region. Stubs are
  allowed to run past the frame and be clipped — 690 of the 740 clear it whole.

### Constellations

- One **white** `#FFFFFF` dot per system, `r 1.3`. No security ramp.
- One **red** `#DC2626` line per stargate jump inside the constellation, at
  `w 1.5` and `stroke-opacity` 0.7 against the region's `w 0.75` and 0.55. Red
  goes muddy on the site's dark surfaces at the lower opacity, and with a tenth
  of the systems there is no mass of lines to read as texture — each one has to
  carry on its own.
- A 10-unit **dark blue** `#1D4ED8` stub for each gate leaving the
  constellation.

The two do not share a palette because they are not the same drawing at two
zoom levels. A constellation averages 7,2 systems against a region's 74,5, and
its outbound gates run about 1:2 against internal jumps instead of 1:9 — the
edges of a constellation are most of what there is to see, so they get a colour
of their own.

Both have a transparent background. The site has a single dark theme and the
image sits on three different surfaces, one of which changes on hover
(`.card-row` in `cards.css`), so a baked-in background would leave a dark
square behind.

The drawing itself is in
[`../../src/scripts/star-map-svg.ts`](../../src/scripts/star-map-svg.ts), which
knows nothing about the database and is covered by unit tests — `REGION_PALETTE`
and `CONSTELLATION_PALETTE` are the two palettes above. The scripts that query
and write are
[`../../src/scripts/render-region-maps.ts`](../../src/scripts/render-region-maps.ts)
and
[`../../src/scripts/render-constellation-maps.ts`](../../src/scripts/render-constellation-maps.ts).

## Sizes

There is one file per region and per constellation, used at every size — 20px
in a line of text, 24px in a table row, 64px in a list row, 96px in the
constellation header, 256px in the region header (96px below the `sm`
breakpoint). An SVG has no resolution, so there is nothing to export at 2x and
no `srcset`.

What does change with size is line weight: everything scales together, and the
frame is always 114,6 units across, so a line of width `w` at `p` pixels lands
at `w × p / 114,6`. A region jump line at 64px is about 0,4 of a pixel and reads
faint; the constellation's `w 1.5` is about 0,8 there and 1,3 at the 96px
header. If a weight turns out wrong in place, change `jumpWidth` in the relevant
palette in `star-map-svg.ts` and re-run — it is one number. Region's is still
the open one.

## Maps with nothing to draw

Regions:

- 46 regions, all wormhole and abyssal space, have no stargate connections.
  They render as dots only. That is correct: those regions genuinely have no
  gate topology.
- 48 regions have no gates leaving them, so they carry no green.
- 3 regions hold a single system (G-R00031, GPMR-01, Yasna Zakh): two render as
  a dot, and Yasna Zakh renders as a dot with four green stubs.

Constellations:

- 418 constellations, holding 3.222 systems, have no stargate connections at
  all — wormhole and abyssal space again. They render as white dots only.
- 420 have no internal jump at all: the 418 above, plus two that only have
  gates leaving them.
- 8 hold a single system. Manifest District is the one worth knowing: one dot
  with five dark blue stubs and nothing else.

None of these get a substitute image.
