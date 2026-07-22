/**
 * WCAG contrast ratio utilities, used by the Theme Designer panel to warn on
 * color combinations that fail accessibility guidelines.
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function channelLuminance(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  )
}

/**
 * WCAG contrast ratio between two hex colors, from 1 (no contrast) to 21 (max).
 * Returns null if either color can't be parsed.
 */
export function getContrastRatio(hex1: string, hex2: string): number | null {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  if (l1 === null || l2 === null) return null
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Whether two colors meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large text/UI).
 */
export function meetsWCAGAA(hex1: string, hex2: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(hex1, hex2)
  if (ratio === null) return true // can't evaluate, don't warn on unparsable input
  return ratio >= (isLargeText ? 3 : 4.5)
}
