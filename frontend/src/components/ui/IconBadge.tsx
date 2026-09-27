import type { ComponentType, ReactNode, SVGProps } from 'react';

/*
 * `sm` is the killmail table's attackers cell. `md` is the same badge at the
 * size a .card-title sets its text, 16px, for when the badge is a card's
 * heading; it is also the size the table badge had before it was taken down a
 * quarter. Every class is spelled out whole so Tailwind sees it.
 */
const SIZES = {
  sm: {
    text: 'text-xs/4.5',
    icon: 'size-3',
    iconPad: 'px-1',
    labelPad: 'px-1.5 py-px',
  },
  md: {
    text: 'text-base/6',
    icon: 'size-4',
    iconPad: 'px-1.5',
    labelPad: 'px-2 py-0.5',
  },
} as const;

/**
 * Two parts inside one border: the icon cut out of a solid fill in the page's
 * own dark, the label on no ground of its own so the border alone frames it.
 * One grey throughout — the badges are told apart by their icon and their
 * word, and colour down a whole table was tiring to read.
 */
export default function IconBadge({
  icon: Icon,
  size = 'sm',
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  size?: keyof typeof SIZES;
  children: ReactNode;
}) {
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex items-stretch font-medium border border-ink-faint tabular-nums ${s.text}`}
    >
      <span
        className={`flex items-center text-ground bg-ink-faint ${s.iconPad}`}
      >
        <Icon aria-hidden="true" className={s.icon} />
      </span>
      <span className={`text-ink-faint ${s.labelPad}`}>{children}</span>
    </span>
  );
}
