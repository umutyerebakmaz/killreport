"use client";

import {
  calculateViewBox,
  generateFitLayout,
  getSlotColor,
  type LayoutConfig,
} from "@/utils/fitLayout";

interface Module {
  slot_type: "high" | "mid" | "low" | "rig" | "subsystem";
  slot_index: number;
  type_id: number;
  type_name: string;
  icon_url?: string;
  quantity?: number;
}

interface FitScreenSVGProps {
  shipName: string;
  shipImageUrl: string;
  modules: Module[];
  highSlots: number;
  midSlots: number;
  lowSlots: number;
  rigSlots: number;
  subsystemSlots?: number;
  config?: Partial<LayoutConfig>;
}

export default function FitScreenSVG({
  shipName,
  shipImageUrl,
  modules,
  highSlots,
  midSlots,
  lowSlots,
  rigSlots,
  subsystemSlots = 0,
  config,
}: FitScreenSVGProps) {
  const layoutConfig: LayoutConfig = {
    centerX: 400,
    centerY: 300,
    shipRadius: 120,
    slotRadius: 30,
    slotDistance: 200,
    ...config,
  };

  // Slot pozisyonlarını hesapla
  const slotPositions = generateFitLayout(
    highSlots,
    midSlots,
    lowSlots,
    rigSlots,
    subsystemSlots,
    layoutConfig
  );

  // Modülleri slotlara eşle
  const moduleMap = new Map<string, Module>();
  modules.forEach((mod) => {
    const slotId = `${mod.slot_type}-${mod.slot_index}`;
    moduleMap.set(slotId, mod);
  });

  const viewBox = calculateViewBox(layoutConfig);

  return (
    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden">
      <svg
        viewBox={viewBox}
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tanımlar (gradients, filters, etc.) */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="bg-gradient">
            <stop offset="0%" stopColor="rgba(30, 41, 59, 0.8)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 1)" />
          </radialGradient>
        </defs>

        {/* Layer 1: Background */}
        <g id="background-layer">
          <circle
            cx={layoutConfig.centerX}
            cy={layoutConfig.centerY}
            r={layoutConfig.slotDistance + 50}
            fill="url(#bg-gradient)"
            opacity="0.5"
          />

          {/* Grid lines */}
          <circle
            cx={layoutConfig.centerX}
            cy={layoutConfig.centerY}
            r={layoutConfig.shipRadius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle
            cx={layoutConfig.centerX}
            cy={layoutConfig.centerY}
            r={layoutConfig.slotDistance}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </g>

        {/* Layer 2: Slot Templates (boş slotlar) */}
        <g id="slot-template-layer">
          {slotPositions.map((slot) => {
            const hasModule = moduleMap.has(slot.id);
            const slotColor = getSlotColor(slot.type);

            return (
              <g key={slot.id}>
                {/* Slot dairesi */}
                <circle
                  cx={slot.x}
                  cy={slot.y}
                  r={layoutConfig.slotRadius}
                  fill={hasModule ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.3)"}
                  stroke={slotColor}
                  strokeWidth="2"
                  opacity={hasModule ? 1 : 0.5}
                  filter={hasModule ? "url(#glow)" : undefined}
                />

                {/* Slot tipi göstergesi (boş slotlar için) */}
                {!hasModule && (
                  <text
                    x={slot.x}
                    y={slot.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={slotColor}
                    fontSize="10"
                    fontWeight="bold"
                    opacity="0.5"
                  >
                    {slot.type.charAt(0).toUpperCase()}
                  </text>
                )}

                {/* Bağlantı çizgisi (merkeze) */}
                <line
                  x1={slot.x}
                  y1={slot.y}
                  x2={layoutConfig.centerX}
                  y2={layoutConfig.centerY}
                  stroke={slotColor}
                  strokeWidth="1"
                  opacity="0.2"
                  strokeDasharray="2 2"
                />
              </g>
            );
          })}
        </g>

        {/* Layer 3: Ship Image (center) */}
        <g id="ship-layer">
          <image
            href={shipImageUrl}
            x={layoutConfig.centerX - layoutConfig.shipRadius}
            y={layoutConfig.centerY - layoutConfig.shipRadius}
            width={layoutConfig.shipRadius * 2}
            height={layoutConfig.shipRadius * 2}
            style={{ filter: "drop-shadow(0 0 10px rgba(0, 0, 0, 0.8))" }}
          />

          {/* Ship adı */}
          <text
            x={layoutConfig.centerX}
            y={layoutConfig.centerY + layoutConfig.shipRadius + 25}
            textAnchor="middle"
            fill="white"
            fontSize="16"
            fontWeight="bold"
          >
            {shipName}
          </text>
        </g>

        {/* Layer 4: Modules (foreignObject ile HTML içerik) */}
        <g id="modules-layer">
          {slotPositions.map((slot) => {
            const module = moduleMap.get(slot.id);
            if (!module) return null;

            const moduleSize = layoutConfig.slotRadius * 1.6;

            return (
              <foreignObject
                key={slot.id}
                x={slot.x - moduleSize / 2}
                y={slot.y - moduleSize / 2}
                width={moduleSize}
                height={moduleSize}
              >
                <div
                  className="w-full h-full flex items-center justify-center
                           hover:scale-125 transition-transform duration-200 cursor-pointer
                           group"
                  title={module.type_name}
                >
                  {module.icon_url ? (
                    <img
                      src={module.icon_url}
                      alt={module.type_name}
                      className="w-full h-full object-contain rounded"
                      style={{
                        filter: "drop-shadow(0 0 4px rgba(0, 0, 0, 0.8))",
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">
                      {module.type_name.substring(0, 3)}
                    </div>
                  )}

                  {/* Quantity badge */}
                  {module.quantity && module.quantity > 1 && (
                    <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {module.quantity}
                    </div>
                  )}
                </div>
              </foreignObject>
            );
          })}
        </g>

        {/* Layer 5: Interactive overlay (hover effects için) */}
        <g id="overlay-layer" pointerEvents="none">
          {slotPositions.map((slot) => {
            const module = moduleMap.get(slot.id);
            if (!module) return null;

            return (
              <circle
                key={`overlay-${slot.id}`}
                cx={slot.x}
                cy={slot.y}
                r={layoutConfig.slotRadius + 5}
                fill="none"
                stroke={getSlotColor(slot.type)}
                strokeWidth="2"
                opacity="0"
                className="hover:opacity-100 transition-opacity"
              />
            );
          })}
        </g>
      </svg>

      {/* Stats overlay (SVG dışında, HTML) */}
      <div className="absolute top-4 left-4 bg-black/70 rounded p-3 text-sm">
        <div className="flex gap-4">
          <div>
            <span className="text-red-400">High:</span> {highSlots}
          </div>
          <div>
            <span className="text-yellow-400">Mid:</span> {midSlots}
          </div>
          <div>
            <span className="text-green-400">Low:</span> {lowSlots}
          </div>
          <div>
            <span className="text-blue-400">Rig:</span> {rigSlots}
          </div>
        </div>
      </div>
    </div>
  );
}
