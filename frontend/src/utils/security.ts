// Security status utility functions for EVE Online

export type SecurityLevel = 'high-sec' | 'low-sec' | 'null-sec' | 'wormhole';

export function getSecurityLevel(securityStatus: number | null | undefined): SecurityLevel {
    if (securityStatus === null || securityStatus === undefined) {
        return 'wormhole';
    }
    if (securityStatus >= 0.5) {
        return 'high-sec';
    }
    if (securityStatus > 0.0) {
        return 'low-sec';
    }
    return 'null-sec';
}

export function getSecurityColor(securityStatus: number | null | undefined): string {
    const level = getSecurityLevel(securityStatus);
    switch (level) {
        case 'high-sec':
            return 'text-green-400';
        case 'low-sec':
            return 'text-yellow-400';
        case 'null-sec':
            return 'text-red-400';
        case 'wormhole':
            return 'text-purple-400';
    }
}

export function getSecurityBgColor(securityStatus: number | null | undefined): string {
    const level = getSecurityLevel(securityStatus);
    switch (level) {
        case 'high-sec':
            return 'bg-green-500/20';
        case 'low-sec':
            return 'bg-yellow-500/20';
        case 'null-sec':
            return 'bg-red-500/20';
        case 'wormhole':
            return 'bg-purple-500/20';
    }
}

export function getSecurityBorderColor(securityStatus: number | null | undefined): string {
    const level = getSecurityLevel(securityStatus);
    switch (level) {
        case 'high-sec':
            return 'border-green-500/50';
        case 'low-sec':
            return 'border-yellow-500/50';
        case 'null-sec':
            return 'border-red-500/50';
        case 'wormhole':
            return 'border-purple-500/50';
    }
}

export function getSecurityLabel(securityStatus: number | null | undefined): string {
    const level = getSecurityLevel(securityStatus);
    switch (level) {
        case 'high-sec':
            return 'High Sec';
        case 'low-sec':
            return 'Low Sec';
        case 'null-sec':
            return 'Null Sec';
        case 'wormhole':
            return 'Wormhole';
    }
}

export function formatSecurityStatus(securityStatus: number | null | undefined): string {
    if (securityStatus === null || securityStatus === undefined) {
        return 'W-Space';
    }
    return securityStatus.toFixed(2);
}
