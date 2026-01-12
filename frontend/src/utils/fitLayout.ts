/**
 * EVE Online style fit screen layout calculator
 * Calculates slot positions in circular/arc patterns
 */

export interface SlotPosition {
    id: string;
    type: 'high' | 'mid' | 'low' | 'rig' | 'subsystem';
    x: number;
    y: number;
    angle: number;
}

export interface LayoutConfig {
    centerX: number;
    centerY: number;
    shipRadius: number; // Ship merkez yarıçapı
    slotRadius: number; // Slot daire yarıçapı
    slotDistance: number; // Merkezden slot merkeze mesafe
}

const DEFAULT_CONFIG: LayoutConfig = {
    centerX: 400,
    centerY: 300,
    shipRadius: 120,
    slotRadius: 30,
    slotDistance: 180,
};

/**
 * Dairesel düzende slot pozisyonları hesapla
 * @param startAngle Başlangıç açısı (derece, 0 = sağ)
 * @param endAngle Bitiş açısı
 * @param count Slot sayısı
 * @param distance Merkezden mesafe
 */
export function calculateArcPositions(
    startAngle: number,
    endAngle: number,
    count: number,
    distance: number,
    config: LayoutConfig = DEFAULT_CONFIG
): { x: number; y: number; angle: number }[] {
    const positions = [];
    const angleStep = (endAngle - startAngle) / (count > 1 ? count - 1 : 1);

    for (let i = 0; i < count; i++) {
        const angle = startAngle + angleStep * i;
        const radians = (angle * Math.PI) / 180;

        positions.push({
            x: config.centerX + distance * Math.cos(radians),
            y: config.centerY + distance * Math.sin(radians),
            angle,
        });
    }

    return positions;
}

/**
 * EVE Online tarzı fit layout
 * High slots: Üst yay (270-450 derece = -90 ile +90)
 * Mid slots: Orta yay (sağ taraf)
 * Low slots: Alt yay
 * Rig slots: Sağ dikey dizi
 */
export function generateFitLayout(
    highCount: number,
    midCount: number,
    lowCount: number,
    rigCount: number,
    subsystemCount: number = 0,
    config: LayoutConfig = DEFAULT_CONFIG
): SlotPosition[] {
    const slots: SlotPosition[] = [];

    // High slots: Üst yay (-120 ile -60 derece)
    const highPositions = calculateArcPositions(-120, -60, highCount, config.slotDistance, config);
    highPositions.forEach((pos, idx) => {
        slots.push({ id: `high-${idx}`, type: 'high', ...pos });
    });

    // Mid slots: Sağ üst yay (-30 ile 30 derece)
    const midPositions = calculateArcPositions(-30, 30, midCount, config.slotDistance, config);
    midPositions.forEach((pos, idx) => {
        slots.push({ id: `mid-${idx}`, type: 'mid', ...pos });
    });

    // Low slots: Alt yay (60 ile 120 derece)
    const lowPositions = calculateArcPositions(60, 120, lowCount, config.slotDistance, config);
    lowPositions.forEach((pos, idx) => {
        slots.push({ id: `low-${idx}`, type: 'low', ...pos });
    });

    // Rig slots: Sağ taraf dikey dizi
    const rigStartY = config.centerY - (rigCount * 60) / 2;
    for (let i = 0; i < rigCount; i++) {
        slots.push({
            id: `rig-${i}`,
            type: 'rig',
            x: config.centerX + config.slotDistance + 80,
            y: rigStartY + i * 60,
            angle: 0,
        });
    }

    // Subsystem slots: Sol taraf dikey dizi (T3 cruiserlar için)
    if (subsystemCount > 0) {
        const subStartY = config.centerY - (subsystemCount * 60) / 2;
        for (let i = 0; i < subsystemCount; i++) {
            slots.push({
                id: `subsystem-${i}`,
                type: 'subsystem',
                x: config.centerX - config.slotDistance - 80,
                y: subStartY + i * 60,
                angle: 180,
            });
        }
    }

    return slots;
}

/**
 * Slot tipi için renk
 */
export function getSlotColor(type: SlotPosition['type']): string {
    const colors = {
        high: '#FF6B6B', // Kırmızı tonları (weapons)
        mid: '#FFD93D', // Sarı tonları (shield/prop)
        low: '#6BCB77', // Yeşil tonları (armor/damage)
        rig: '#4D96FF', // Mavi tonları
        subsystem: '#9D4EDD', // Mor tonları
    };
    return colors[type];
}

/**
 * Responsive viewport hesapla
 */
export function calculateViewBox(config: LayoutConfig): string {
    const padding = 100;
    const maxDistance = config.slotDistance + config.slotRadius + padding;

    return `${config.centerX - maxDistance} ${config.centerY - maxDistance} ${maxDistance * 2} ${maxDistance * 2}`;
}
