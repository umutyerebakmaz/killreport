import { useEffect, useState } from "react";

export default function EveTime() {
  const [eveTime, setEveTime] = useState<string>("");

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      const utcTime = now.toISOString().slice(11, 16); // HH:MM
      setEveTime(utcTime);
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="text-white">{eveTime} UTC</span>;
}
