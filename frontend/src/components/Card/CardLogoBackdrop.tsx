import EveImage from '../ui/EveImage';

type CardLogoBackdropProps = {
  kind: 'alliance' | 'corporation' | 'character';
  id: number;
  name: string;
  /** The size the card draws its own image at; 128 on the list cards. */
  size?: number;
};

/**
 * The entity's own logo, blown up to cover the whole card and blurred, with a
 * dark wash over it so the card reads as glass tinted by the logo. The parent
 * must be `relative overflow-hidden`, and its content must sit above this
 * (`relative`), since this is drawn first and positioned.
 *
 * On hover it grows by the same 5% as KillmailCard's render does
 * (1.25 × 1.05), inside a card whose border lightens the same way; the card
 * must be the `group`. The detail page headers are not links, so they are not
 * a `group` and the backdrop stays still.
 *
 * Fetched at the size the card draws its own image at — 128 on the list
 * cards, 256 on the detail headers — so it is the same URL and the browser has
 * it already; blurred this hard, more pixels would not show.
 */
export default function CardLogoBackdrop({
  kind,
  id,
  name,
  size = 128,
}: CardLogoBackdropProps) {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <EveImage
        kind={kind}
        id={id}
        name={name}
        size={size}
        className="object-cover transition-transform duration-300 scale-125 size-full blur-2xl opacity-60 group-hover:scale-[1.3125]"
      />
      <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm" />
    </div>
  );
}
