"use client";

import { useEffect, useRef } from "react";
import { sanitizeEveHtml } from "@/utils/eveHtmlParser";

interface EveHtmlRendererProps {
  html: string | null | undefined;
  className?: string;
}

/**
 * Safely renders EVE Online HTML with proper styling
 */
export default function EveHtmlRenderer({
  html,
  className = "",
}: EveHtmlRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && html) {
      const sanitized = sanitizeEveHtml(html);
      containerRef.current.innerHTML = sanitized;
    }
  }, [html]);

  if (!html) return null;

  return (
    <div
      ref={containerRef}
      className={`eve-description whitespace-pre-wrap ${className}`}
      style={{
        wordBreak: "break-word",
        overflowWrap: "break-word",
      }}
    />
  );
}
