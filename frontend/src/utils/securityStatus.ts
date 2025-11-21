/**
 * Security status değerine göre renk döndürür
 */
export const getSecurityStatusColor = (
    status: number | null | undefined
): string => {
    if (status === null || status === undefined) return "text-gray-400";
    if (status >= 5) return "text-blue-400";
    if (status >= 0) return "text-green-400";
    if (status >= -2) return "text-yellow-400";
    if (status >= -5) return "text-orange-400";
    return "text-red-400";
};
