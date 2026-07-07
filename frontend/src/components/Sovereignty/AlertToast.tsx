"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";

export interface ToastAlert {
  id: string;
  type: string;
  message: string;
}

const TYPE_STYLE: Record<string, string> = {
  campaign_started: "border-orange-400/40",
  campaign_ended: "border-cyan-400/40",
  territory_change: "border-yellow-400/40",
};

const TYPE_LABEL: Record<string, string> = {
  campaign_started: "New campaign",
  campaign_ended: "Campaign ended",
  territory_change: "Territory change",
};

function ToastItem({ toast, onDismiss }: { toast: ToastAlert; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 8000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`w-80 border bg-neutral-900/95 backdrop-blur px-4 py-3 shadow-lg ${TYPE_STYLE[toast.type] ?? "border-white/20"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
          {TYPE_LABEL[toast.type] ?? "Sovereignty"}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-gray-500 hover:text-gray-300"
          aria-label="Dismiss"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-1 text-sm text-white">{toast.message}</div>
    </div>
  );
}

export function AlertToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastAlert[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed z-50 flex flex-col gap-2 top-24 right-4">
      {toasts.slice(0, 5).map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
