# Star map images

Every region, constellation and solar system has a map thumbnail:

|                | Path                                                           | Count |
| -------------- | -------------------------------------------------------------- | ----: |
| Regions        | `frontend/public/images/regions/{region_id}.svg`               |   114 |
| Constellations | `frontend/public/images/constellations/{constellation_id}.svg` | 1.184 |
| Solar systems  | `frontend/public/images/solar-systems/{system_id}.svg`         | 8.089 |

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

`render:maps` runs all three renderers. Run them separately —
`render:region-maps`, `render:constellation-maps`, `render:solar-system-maps`
— only when you have a reason to; refreshing one set and leaving the others
behind means they are drawn from different topology.

Expected output today:

```
114 regions written to .../frontend/public/images/regions
  8490 systems, 6619 internal jumps, 740 outbound gates
  0 stale files removed
1184 constellations written to .../frontend/public/images/constellations
  8490 systems, 5704 internal jumps, 2570 outbound gates
  0 stale files removed
8089 solar systems written to .../frontend/public/images/solar-systems
  68407 planets, 8089 stars
  401 systems skipped: no star and no planet
  0 stale files removed
```

Then commit whatever changed. The diff is the record of what the SDE update
did to the map — that is the reason these live in git rather than in object
storage, with the caveat in "Determinism" below. All three sets together are
about ~8,7 MB raw, and at the constellation set's measured 15% gzip ratio that
is a small fraction of a packed repo.

Each run also deletes any `.svg` in its directory whose region, constellation
or solar system no longer exists, so a retired or renumbered one cannot leave
a stale (or wrong) map behind; expect `0 stale files removed` on an ordinary
run and check the diff if that number is not zero. Reconciliation refuses to
run at all when it would remove more than a quarter of the files on disk —
that shape is an incomplete query, not an SDE retirement, and it matters most
for the 8.089 solar system files.

### Determinism

The region and constellation renderers are **not deterministic**. Neither
`render-region-maps.ts` nor `render-constellation-maps.ts` puts an `ORDER BY`
on its `solar_systems` or `stargates` query, so element order inside each SVG
follows whatever order Postgres happens to return rows in that run. Re-running
either script today, with no source change at all, rewrites 112 of the 114
region files and up to 1.061 of the 1.184 constellation files with identical
content in a different order — verified on
`frontend/public/images/regions/10000001.svg`, where the committed file and a
freshly regenerated one both hold 117 `<circle>` and 166 `<line>` elements,
equal as sets but not byte-for-byte. So a non-empty
`git status --porcelain` on `frontend/public/images/regions` or
`.../constellations` after a plain re-run does not by itself mean the topology
changed — check whether the element counts moved before concluding anything
did. This is a known defect with its own fix queued separately: correcting the
ordering would rewrite the ~1.173 files already committed to those two sets,
which does not belong inside an unrelated change.

The solar system renderer does not share this defect. Its planet query carries
`ORDER BY solar_system_id, orbit_index, planet_id`, its star rows key a `Map`
by system id, its system ids are sorted numerically before rendering, and the
drawing module sorts its own orbit rings. Two consecutive full runs against
unchanged data have produced byte-identical output across all 8.089 files
(checksum `f64cccbc3ecac5ce76528a9da464983f911f2417` both times) — a non-empty
diff there is a reliable signal that something upstream changed.

## What it draws

The region and constellation maps share every line of geometry: `x` becomes
screen x, `−z` becomes screen y, the long axis is normalised to 0–100, each
jump is drawn once, and outbound stubs run 10 units towards their destination
and are allowed to clip. Only the palette differs. The solar system map does
not share this geometry at all — see below.

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

### Solar systems

Not a topology drawing: the input is one star plus a planet list, not
`{ systems, jumps, gates }`.

- One star at the centre, `r 2.6`, coloured by the first letter of its Harvard
  spectral class.
- One dot per planet, `r 1.6`, coloured by its `type_id`.
- One `#475569` orbit ring per planet, `fill="none"`, `stroke-width 0.6`.
  Radius is scaled logarithmically onto a 9–46 range: the innermost real orbit
  is 2.44e10 m and the outermost 3.04e13, 1,246 times wider, so a linear scale
  would collapse a system's inner planets into the star. Angle is the planet's
  real orbital angle — an even spacing would leave two systems differing only
  by planet count.

Planet colour, by `type_id`:

| `type_id` | Type            | Planets | Colour    |
| --------: | --------------- | ------: | --------- |
|        13 | Gas             |  20.402 | `#a78bfa` |
|      2016 | Barren          |  19.859 | `#9ca3af` |
|        11 | Temperate       |   7.240 | `#4ade80` |
|      2015 | Lava            |   6.651 | `#f97316` |
|      2017 | Storm           |   5.599 | `#22d3ee` |
|        12 | Ice             |   3.345 | `#e0f2fe` |
|      2014 | Oceanic         |   3.056 | `#2563eb` |
|      2063 | Plasma          |   1.541 | `#e879f9` |
|     30889 | Shattered       |     713 | `#f43f5e` |
|     73911 | Scorched Barren |       1 | Barren's  |

Star colour, by Harvard class:

| Class | Stars | Colour    |
| ----- | ----: | --------- |
| K     | 3.385 | `#ffd2a1` |
| G     | 2.160 | `#fff4ea` |
| M     | 1.282 | `#ffcc6f` |
| F     | 1.156 | `#f8f7ff` |
| A     |   106 | `#cad7ff` |

`O` and `B` carry a colour in the table but occur nowhere in the universe
today — kept so an SDE addition draws right instead of falling to the
default. An unknown or missing `type_id` draws Barren's grey (`#9ca3af`); an
unknown or missing spectral class draws sun-like white (`#fff4ea`, class G).

This map does not share `star-map-svg.ts` with the region and constellation
maps, the way those two share one palette type with each other: its input
isn't a graph. It lives in its own module,
[`../../src/scripts/solar-system-map-svg.ts`](../../src/scripts/solar-system-map-svg.ts).
The script that queries and writes is
[`../../src/scripts/render-solar-system-maps.ts`](../../src/scripts/render-solar-system-maps.ts).

## Sizes

There is one file per region, constellation and solar system, used at every
size — 20px in a line of text, 24px in a table row, 64px in a list row, and
256px in a detail header (96px below the `sm` breakpoint). An SVG has no
resolution, so there is nothing to export at 2x and no `srcset`.

What does change with size is line weight: everything scales together, and
the region and constellation frame is always 114,6 units across, so a line of
width `w` at `p` pixels lands at `w × p / 114,6`. A region jump line at 64px is
about 0,4 of a pixel and reads faint; the constellation's `w 1.5` is about 0,8
there and 1,3 at the 96px header. If a weight turns out wrong in place, change
`jumpWidth` in the relevant palette in `star-map-svg.ts` and re-run — it is one
number. Region's is still the open one.

The solar system frame is **100 units**, not 114,6 — the drawing is centred
and circular, so its padding does not need to carry an outbound stub, and the
formula becomes `w × p / 100`. The 0,6 orbit ring lands at 1,54 pixels at
256px, 0,38 at 64px, and 0,12 at 20px — effectively nothing, so at 24px and
below the planet dots carry the map on their own, not the ring. `RING_WIDTH`
in `solar-system-map-svg.ts` is the number to calibrate, the same way
`jumpWidth` is for the other two.

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

Solar systems:

- 401 systems have neither a star nor a planet: 200 abyssal (`ADR01`…), 200
  void (`VR-01`), and `GPMS-01`. They get no file at all.
- Zarzakh (30100000) has a star (F7 V) and no planets — the only system in the
  universe in that position — and renders as a single dot. No system has the
  reverse: a planet with no star.
- 14 systems have exactly one planet. With no second radius to form a span,
  the ring sits at the ramp's midpoint, 27,5.

None of these get a substitute image.
