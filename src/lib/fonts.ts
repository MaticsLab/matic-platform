/**
 * Curated Google Fonts list for the portal Theme Designer + standalone form
 * renderer. Loaded at runtime via a swapped <link> tag (not next/font) since
 * the selection changes dynamically based on saved theme data, not a
 * build-time import.
 */

export interface GoogleFontOption {
  key: string
  label: string
  cssUrl: string | null // null for the system-default option (no font to load)
  fontFamily: string
}

export const GOOGLE_FONTS: GoogleFontOption[] = [
  {
    key: 'system',
    label: 'System default',
    cssUrl: null,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    key: 'open_sans',
    label: 'Open Sans',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap',
    fontFamily: '"Open Sans", sans-serif',
  },
  {
    key: 'inter',
    label: 'Inter',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    fontFamily: '"Inter", sans-serif',
  },
  {
    key: 'lato',
    label: 'Lato',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;500;700&display=swap',
    fontFamily: '"Lato", sans-serif',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    fontFamily: '"Roboto", sans-serif',
  },
  {
    key: 'poppins',
    label: 'Poppins',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
    fontFamily: '"Poppins", sans-serif',
  },
  {
    key: 'nunito',
    label: 'Nunito',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap',
    fontFamily: '"Nunito", sans-serif',
  },
  {
    key: 'merriweather',
    label: 'Merriweather',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
    fontFamily: '"Merriweather", serif',
  },
  {
    key: 'playfair_display',
    label: 'Playfair Display',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
    fontFamily: '"Playfair Display", serif',
  },
]

export const DEFAULT_FONT_KEY = 'open_sans'

export function getGoogleFont(key: string | undefined): GoogleFontOption {
  return GOOGLE_FONTS.find(f => f.key === key) || GOOGLE_FONTS.find(f => f.key === DEFAULT_FONT_KEY)!
}

const LOADED_FONT_LINK_ID_PREFIX = 'matic-google-font-'

/**
 * Injects (or swaps) a <link rel="stylesheet"> for the given font key into
 * document.head. Safe to call repeatedly / with a changing key — only one
 * link tag for this purpose exists at a time.
 */
export function loadGoogleFont(key: string | undefined) {
  if (typeof document === 'undefined') return
  const font = getGoogleFont(key)

  const existing = document.head.querySelector('link[data-matic-google-font]')
  if (!font.cssUrl) {
    existing?.remove()
    return
  }

  const linkId = `${LOADED_FONT_LINK_ID_PREFIX}${font.key}`
  if (existing?.id === linkId) return // already loaded

  existing?.remove()
  const link = document.createElement('link')
  link.id = linkId
  link.rel = 'stylesheet'
  link.href = font.cssUrl
  link.setAttribute('data-matic-google-font', font.key)
  document.head.appendChild(link)
}
