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
