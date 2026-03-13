/**
 * Formats a date string into human-readable EVE Online standard format: YYYY.MM.DD HH:MM
 * @param dateString - ISO date string or null/undefined
 * @returns Formatted date string or "Unknown"
 */
export const humanReadableDate = (dateString: string | null | undefined) => {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}`;
};

/**
 * Calculates age from a date string, returning a human-readable format
 * @param dateString - ISO date string or null/undefined
 * @returns Age string like "2 years, 4 months and 17 days" or "Unknown"
 */
export const calculateAge = (dateString: string | null | undefined) => {
  if (!dateString) return "Unknown";
  const birthDate = new Date(dateString);
  const now = new Date();

  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  let days = now.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);

  if (parts.length === 0) return "Today";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
};

/**
 * Formats a killmail time to display format (HH:MM:SS)
 * @param dateString - ISO date string
 * @returns Time string in UTC
 */
export const formatKillmailTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

/**
 * Formats a killmail date to display format (Month, Day)
 * @param dateString - ISO date string
 * @returns Date string in UTC (e.g., "March, 11")
 */
export const formatKillmailDate = (dateString: string) => {
  const date = new Date(dateString);
  const month = date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
  });
  const day = date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
  });
  return `${month}, ${day}`;
};

/**
 * Formats a killmail date and time for tooltip display
 * @param dateString - ISO date string
 * @returns Formatted date and time string in UTC
 */
export const formatKillmailDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${dateStr} ${timeStr} UTC`;
};

/**
 * Formats a date string to "time ago" format
 * @param dateInput - ISO date string or Date object
 * @param short - If true, uses short format (5m ago, 2h ago). Default: false
 * @returns Human-readable time ago string (e.g., "2 hours ago", "just now")
 */
export const formatTimeAgo = (
  dateInput: string | Date | null | undefined,
  short: boolean = false,
) => {
  if (!dateInput) return "Unknown";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  // Check for invalid date
  if (isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

  if (diffInMinutes < 1) {
    return "just now";
  } else if (diffInMinutes < 60) {
    const mins = Math.floor(diffInMinutes);
    return short
      ? `${mins}m ago`
      : `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return short
      ? `${hours}h ago`
      : `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return short
      ? `${days}d ago`
      : `${days} ${days === 1 ? "day" : "days"} ago`;
  }
};
