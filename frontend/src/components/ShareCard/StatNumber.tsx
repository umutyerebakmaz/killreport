import { SHARE } from '@/lib/shareCard/palette';

/** A big number with its small upper-case label 6px underneath. */
export default function StatNumber({
  value,
  label,
  color,
  size,
}: {
  value: string;
  label: string;
  color: string;
  size: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1,
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 24,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: SHARE.faint,
        }}
      >
        {label}
      </div>
    </div>
  );
}
