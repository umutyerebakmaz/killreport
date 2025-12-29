import { ReactNode, useState } from "react";
import "./tooltip.css";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
}

const positionClasses: Record<TooltipPosition, string> = {
  top: "bottom-full mb-3 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-3 left-1/2 -translate-x-1/2",
  left: "right-full mr-3 top-1/2 -translate-y-1/2",
  right: "left-full ml-3 top-1/2 -translate-y-1/2",
};

export default function Tooltip({
  content,
  children,
  position = "top",
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
    <span
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {(show || animating) && (
        <span
          className={`absolute z-10 ${
            positionClasses[position]
          } px-2 py-1 text-sm text-gray-300 bg-black outline-1 -outline-offset-1 outline-white/20 shadow-lg whitespace-nowrap tooltip-anim${
            show ? " tooltip-in" : " tooltip-out"
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
