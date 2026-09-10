import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';
import SovereigntyLogo, {
  SovereigntyHolder,
} from '@/components/Sovereignty/SovereigntyLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
import Link from 'next/link';

interface ConstellationCardProps {
  constellation: {
    id: number;
    name: string;
    solarSystemCount: number;
    sovereignty?: SovereigntyHolder | null;
  };
}

export default function ConstellationCard({
  constellation,
}: ConstellationCardProps) {
  return (
    <div className="p-4 transition-all border bg-surface border-white/5 hover:bg-surface-inset hover:border-white/20">
      <div className="flex items-start gap-3">
        <ConstellationMap
          constellationId={constellation.id}
          constellationName={constellation.name}
          size={64}
          className="shrink-0"
        />

        <div className="flex-1 min-w-0">
          <Tooltip content="Show constellation detail">
            <Link
              href={`/constellations/${constellation.id}`}
              prefetch={false}
              className="font-medium text-gray-200 transition-colors hover:text-cyan-400"
            >
              {constellation.name}
            </Link>
          </Tooltip>
          <div className="text-base text-gray-500">
            {constellation.solarSystemCount}{' '}
            {constellation.solarSystemCount === 1 ? 'system' : 'systems'}
          </div>
        </div>

        {/* The holder is the logo alone; its name lives in the tooltip. */}
        <SovereigntyLogo
          holder={constellation.sovereignty}
          size={32}
          totalSystems={constellation.solarSystemCount}
          className="self-center shrink-0"
        />
      </div>
    </div>
  );
}
