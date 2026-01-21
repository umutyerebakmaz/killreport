import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./tooltip.css";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  wrapText?: boolean;
}

export default function Tooltip({
  content,
  children,
  position = "top",
  wrapText = false,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  function handleEnter() {
    setShow(true);
  }

  function handleLeave() {
    setShow(false);
  }

  useEffect(() => {
    if (show && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = triggerRect.top - tooltipRect.height - 8;
          left =
            triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case "bottom":
          top = triggerRect.bottom + 8;
          left =
            triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case "left":
          top =
            triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left - tooltipRect.width - 8;
          break;
        case "right":
          top =
            triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + 8;
          break;
      }

      setTooltipPos({ top, left });
    }
  }, [show, position]);

  return (
    <>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
      </div>
      {show &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`tooltip ${wrapText ? "tooltip-wrap" : ""}`}
            style={{
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
