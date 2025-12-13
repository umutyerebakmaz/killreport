"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import {
  formatSecurityStatus,
  getSecurityColor,
  getSecurityLabel,
} from "@/utils/security";

interface SecurityStatusProps {
  securityStatus: number | null | undefined;
  showLabel?: boolean;
}

export default function SecurityStatus({
  securityStatus,
  showLabel = false,
}: SecurityStatusProps) {
  const textColor = getSecurityColor(securityStatus);
  const label = getSecurityLabel(securityStatus);
  const formatted = formatSecurityStatus(securityStatus);

  return (
    <Tooltip content={label} position="top">
      <span
        className={`inline-flex items-center gap-1 font-medium text-base ${textColor}`}
      >
        <span>{formatted}</span>
        {showLabel && <span className="opacity-75">({label})</span>}
      </span>
    </Tooltip>
  );
}
