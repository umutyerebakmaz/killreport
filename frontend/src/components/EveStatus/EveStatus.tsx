interface EveStatusProps {
  players?: number;
}

export default function EveStatus({ players }: EveStatusProps) {
  return (
    <div className="flex items-center gap-2 text-green-500 cursor-pointer">
      {/* Online players icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5 text-green-400"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 1115 0v.75a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75v-.75z"
        />
      </svg>
      Tranquility {players?.toLocaleString() ?? "-"}
    </div>
  );
}
