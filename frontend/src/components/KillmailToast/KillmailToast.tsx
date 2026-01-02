"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

interface KillmailToast {
  id: string;
  victimName: string | null;
  victimShipName: string | null;
  victimShipTypeId: number | null;
  attackerName: string | null;
  systemName: string | null;
  timestamp: Date;
}

interface KillmailToastContainerProps {
  toasts: KillmailToast[];
  onDismiss: (id: string) => void;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function KillmailToastItem({
  toast,
  onDismiss,
  index,
}: {
  toast: KillmailToast;
  onDismiss: () => void;
  index: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto dismiss after 8 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(onDismiss, 300);
  };

  // Ship image URL from EVE image server
  const shipImageUrl = toast.victimShipTypeId
    ? `https://images.evetech.net/types/${toast.victimShipTypeId}/render?size=64`
    : null;

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${
          isVisible && !isLeaving
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0"
        }
      `}
      style={{
        transitionDelay: `${index * 50}ms`,
      }}
    >
      <div className="relative flex items-start gap-3 p-3 border shadow-xl bg-gray-900/95 backdrop-blur-md border-red-500/30 hover:border-red-500/50 transition-colors min-w-[320px] max-w-[380px]">
        {/* Ship Image */}
        <div className="relative shrink-0">
          {shipImageUrl ? (
            <img
              src={shipImageUrl}
              alt={toast.victimShipName || "Ship"}
              className="object-cover bg-gray-800 border border-gray-700 w-14 h-14"
            />
          ) : (
            <div className="flex items-center justify-center bg-gray-800 border border-gray-700 w-14 h-14">
              <span className="text-2xl">💀</span>
            </div>
          )}
          {/* Kill indicator */}
          <div className="absolute w-3 h-3 bg-red-500 rounded-full -top-1 -right-1 animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Victim */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-red-400 truncate">
              {toast.victimName || "Unknown Pilot"}
            </span>
          </div>

          {/* Ship */}
          <div className="text-xs text-gray-400 truncate">
            lost a{" "}
            <span className="font-medium text-gray-200">
              {toast.victimShipName || "Unknown Ship"}
            </span>
          </div>

          {/* Attacker & System */}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {toast.attackerName && (
              <>
                <span className="truncate">by {toast.attackerName}</span>
                <span>•</span>
              </>
            )}
            {toast.systemName && (
              <span className="truncate">{toast.systemName}</span>
            )}
          </div>

          {/* Time */}
          <div className="mt-1 text-xs text-gray-600">
            {formatTimeAgo(toast.timestamp)}
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute p-1 text-gray-500 transition-colors top-2 right-2 hover:text-gray-300 hover:bg-gray-800"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function KillmailToastContainer({
  toasts,
  onDismiss,
}: KillmailToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed z-50 flex flex-col gap-3 pointer-events-none top-24 right-4">
      {toasts.slice(0, 5).map((toast, index) => (
        <div key={toast.id} className="pointer-events-auto">
          <KillmailToastItem
            toast={toast}
            onDismiss={() => onDismiss(toast.id)}
            index={index}
          />
        </div>
      ))}

      {/* More indicator */}
      {toasts.length > 5 && (
        <div className="text-center pointer-events-auto">
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-400 border border-gray-700 bg-gray-800/80">
            +{toasts.length - 5} more kills
          </span>
        </div>
      )}
    </div>
  );
}

export { KillmailToastContainer };
export type { KillmailToast };
