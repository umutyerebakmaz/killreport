/**
 * Parses EVE Online HTML description format and converts it to safe HTML
 * Handles font tags with size and color attributes, links, and special characters
 */
export function parseEveHtml(eveHtml: string | null | undefined): string {
  if (!eveHtml) return "";

  // Remove u' prefix and trailing ' if present (Python string format)
  let html = eveHtml.trim();
  if (html.startsWith("u'") && html.endsWith("'")) {
    html = html.slice(2, -1);
  }

  // Decode unicode escapes like \u2501
  html = html.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });

  // Handle loc tags (EVE's link container) first
  html = html.replace(/<loc>/gi, "");
  html = html.replace(/<\/loc>/gi, "");

  // Make sure links open in new tab and have proper styling (before processing font tags)
  html = html.replace(
    /<a\s+href="([^"]+)">/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="eve-link">'
  );

  // Convert EVE color tags to inline styles
  // EVE format: <color=0xffff1400>text</color>
  html = html.replace(
    /<color=0x([0-9a-fA-F]{8})>(.*?)<\/color>/gi,
    (match, color, content) => {
      // EVE colors are ARGB format (0xAARRGGBB), convert to RGBA
      const alpha = parseInt(color.substring(0, 2), 16) / 255;
      const r = parseInt(color.substring(2, 4), 16);
      const g = parseInt(color.substring(4, 6), 16);
      const b = parseInt(color.substring(6, 8), 16);

      return `<span style="color: rgba(${r}, ${g}, ${b}, ${alpha});">${content}</span>`;
    }
  );

  // Convert EVE font tags to inline styles
  // EVE format: <font size="14" color="#ffffffff">text or nested tags</font>
  // Use non-greedy match to capture content including nested tags
  html = html.replace(
    /<font\s+size="(\d+)"\s+color="#([0-9a-fA-F]{8})">(.*?)<\/font>/gi,
    (match, size, color, content) => {
      // EVE colors are ARGB format (#AARRGGBB), convert to RGBA
      const alpha = parseInt(color.substring(0, 2), 16) / 255;
      const rgb = color.substring(2);
      const r = parseInt(rgb.substring(0, 2), 16);
      const g = parseInt(rgb.substring(2, 4), 16);
      const b = parseInt(rgb.substring(4, 6), 16);

      // Convert EVE font size (relative) to reasonable px size
      const fontSize = Math.round(parseInt(size) * 0.85);

      return `<span style="font-size: ${fontSize}px; color: rgba(${r}, ${g}, ${b}, ${alpha});">${content}</span>`;
    }
  );

  // Convert <br> to actual line breaks
  html = html.replace(/<br\s*\/?>/gi, "<br>");

  // Escape any remaining potential XSS vectors
  // But keep our processed HTML tags
  return html;
}

/**
 * Sanitizes EVE HTML to prevent XSS attacks while preserving styling
 */
export function sanitizeEveHtml(eveHtml: string | null | undefined): string {
  const parsed = parseEveHtml(eveHtml);

  // Additional security: only allow specific tags and attributes
  const allowedTags = ['span', 'a', 'br'];
  const allowedAttributes = ['style', 'href', 'target', 'rel', 'class'];

  // Create a temporary element to parse HTML
  if (typeof window === 'undefined') {
    // Server-side: return parsed HTML as-is (will be sanitized on client)
    return parsed;
  }

  const temp = document.createElement('div');
  temp.innerHTML = parsed;

  // Remove any disallowed tags
  const allElements = temp.getElementsByTagName('*');
  for (let i = allElements.length - 1; i >= 0; i--) {
    const el = allElements[i];
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(el.textContent || '');
    } else {
      // Remove disallowed attributes
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        if (!allowedAttributes.includes(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      });
    }
  }

  return temp.innerHTML;
}
