/**
 * The KillReport mark: a tally.
 *
 * Four strokes and the fifth laid across them is what counting has looked like
 * for as long as people have counted, and counting is the only thing a
 * killboard does. It says what the application is for without a word of
 * explanation, in no particular language, and it borrows nothing from CCP —
 * which matters, because the developer licence forbids building a mark out of
 * theirs and the project had no mark at all until now.
 *
 * The four strokes are `currentColor`, so the mark takes the ink of whatever it
 * sits in: grey in the header, white on hover, dark if it is ever drawn on a
 * light ground. The diagonal is the one fixed colour. That split is deliberate
 * — the accent marks the stroke that closes a count, so it is carrying meaning
 * rather than decorating.
 *
 * Geometry on a 24 grid, 3 units thick, no radius, no shadow, in step with the
 * rest of the system. `app/icon.svg` is the same drawing with its colours
 * written out, because a favicon has no stylesheet to inherit from; the two
 * have to be changed together.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="5" width="3" height="14" fill="currentColor" />
      <rect x="8" y="5" width="3" height="14" fill="currentColor" />
      <rect x="13" y="5" width="3" height="14" fill="currentColor" />
      <rect x="18" y="5" width="3" height="14" fill="currentColor" />
      <line
        x1="2"
        y1="18.5"
        x2="22"
        y2="5.5"
        strokeWidth="3"
        className="stroke-accent"
      />
    </svg>
  );
}
