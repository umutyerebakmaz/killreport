import React from "react";

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

export const Loader: React.FC<LoaderProps> = ({
  size = "md",
  text,
  fullHeight = false,
  className = "",
}) => {
  const containerClasses = fullHeight
    ? "flex items-center justify-center min-h-screen"
    : "flex items-center justify-center";

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="flex items-center gap-3">
        <div
          className={`${sizeClasses[size]} border-cyan-500 rounded-full animate-spin border-t-transparent`}
        />
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
