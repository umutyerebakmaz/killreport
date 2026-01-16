import { ReactNode, useState } from "react";
import "./tooltip.css";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  wrapText?: boolean;
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
    <span
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {(show || animating) && (
        <span
          className={`absolute z-[9999] ${
            positionClasses[position]
          } px-3 py-2 text-sm text-gray-300 bg-black outline-1 -outline-offset-1 outline-white/20 shadow-lg ${
            wrapText
              ? "whitespace-normal min-w-[280px] max-w-[320px]"
              : "whitespace-nowrap"
          } tooltip-anim${show ? " tooltip-in" : " tooltip-out"}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
