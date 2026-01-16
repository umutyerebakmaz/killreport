import { ReactNode, useState } from "react";
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
  const [animating, setAnimating] = useState(false);

  function handleEnter() {
    setShow(true);
    setAnimating(true);
  }
  function handleLeave() {
    setAnimating(false);
    setTimeout(() => setShow(false), 200);
  }

  return (
    <div
      className="tooltip-container"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {(show || animating) && (
        <div
          className={`tooltip tooltip-${position} ${
            wrapText ? "tooltip-wrap" : ""
          } tooltip-anim${show ? " tooltip-in" : " tooltip-out"}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
