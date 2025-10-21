import { ReactNode, useState } from "react";
import "./tooltip.css";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
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
          className={`absolute z-10 left-1/2 -translate-x-1/2 top-full mt-3 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap tooltip-anim${
            show ? " tooltip-in" : " tooltip-out"
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
