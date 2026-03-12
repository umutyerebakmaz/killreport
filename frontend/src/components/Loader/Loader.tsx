import Lottie from "lottie-react";
import React, { useEffect, useState } from "react";

interface LoaderProps {
  /** Size of the spinner (default: md) */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional text message to display */
  text?: string;
  /** Whether to center in full height container (default: false) */
  fullHeight?: boolean;
  /** Custom className for the container */
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-4",
  xl: "w-12 h-12 border-4",
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

const lottieSize = {
  sm: 80,
  md: 120,
  lg: 160,
  xl: 240,
};

export const Loader: React.FC<LoaderProps> = ({
  size = "md",
  text,
  fullHeight = false,
  className = "",
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [lottieError, setLottieError] = useState(false);

  useEffect(() => {
    fetch("/animations/loader.json")
      .then((response) => response.json())
      .then((data) => setAnimationData(data))
      .catch(() => setLottieError(true));
  }, []);

  const containerClasses = fullHeight
    ? "flex items-center justify-center min-h-screen"
    : "flex items-center justify-center";

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="flex flex-col items-center gap-3">
        {!lottieError && animationData ? (
          <Lottie
            animationData={animationData}
            loop
            autoplay
            style={{ width: lottieSize[size], height: lottieSize[size] }}
          />
        ) : (
          // Fallback spinner
          <div
            className={`${sizeClasses[size]} border-cyan-500 rounded-full animate-spin border-t-transparent`}
          />
        )}
        {text && (
          <span className={`${textSizeClasses[size]} text-gray-400`}>
            {text}
          </span>
        )}
      </div>
    </div>
  );
};

export default Loader;
