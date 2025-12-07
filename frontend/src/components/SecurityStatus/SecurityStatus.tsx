"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import {
  formatSecurityStatus,
  getSecurityBgColor,
  getSecurityBorderColor,
  getSecurityColor,
  getSecurityLabel,
} from "@/utils/security";

interface SecurityStatusProps {
  securityStatus: number | null | undefined;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function SecurityStatus({
  securityStatus,
  showLabel = false,
  size = "md",
}: SecurityStatusProps) {
  const textColor = getSecurityColor(securityStatus);
  const bgColor = getSecurityBgColor(securityStatus);
  const borderColor = getSecurityBorderColor(securityStatus);
  const label = getSecurityLabel(securityStatus);
  const formatted = formatSecurityStatus(securityStatus);

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  return (
    <Tooltip content={label} position="top">
      <span
        className={`inline-flex items-center gap-1 font-medium border ${sizeClasses[size]} ${textColor} ${bgColor} ${borderColor}`}
      >
        <span>{formatted}</span>
        {showLabel && <span className="opacity-75">({label})</span>}
      </span>
    </Tooltip>
  );
}
