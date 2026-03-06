/**
 * Shared form-data normalization utilities.
 *
 * Used by:
 *  - FormAnalyticsPage (CSV export)
 *  - ApplicationDetail (panel display)
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Strip HTML tags from rich-text labels. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

/**
 * Build a flat { key → human label } map that covers:
 *  - every field UUID  (raw_data uses UUID keys when saved via BuildRawDataFromResponses)
 *  - every field_key   (snake_case / legacy "field-NNN-xxx" keys)
 * All fields in the form, including sub-fields of repeaters/groups, are expected
 * in the same flat `fields` array (the backend's form_fields table is flat).
 */
export function buildLabelMap(
  fields: Array<{ id: string; label: string; name: string }>
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of fields) {
    const clean = stripHtml(f.label || '').trim() || f.name
    if (f.id)   map[f.id]   = clean
    if (f.name) map[f.name] = clean
  }
  return map
}

/**
 * Normalise any raw_data value to a flat, human-readable string.
 * Used for CSV export cells. For rich React display use renderFieldValue in ApplicationDetail.
 */
export function normalizeValueToString(
  val: any,
  _fieldType: string,
  labelMap: Record<string, string>
): string {
  if (val == null || val === '') return ''

  // ── Array ────────────────────────────────────────────────────────────────────
  if (Array.isArray(val)) {
    // Primitive arrays (multi-select, checkbox-group)
    if (val.every(v => typeof v !== 'object' || v === null)) {
      return val.filter(v => v != null).join('; ')
    }
    // Repeater rows – array of objects
    return val
      .filter(row => typeof row === 'object' && row !== null)
      .map(row =>
        Object.entries(row)
          .filter(([k]) => k !== '_id')
          .map(([k, v]) => {
            const colLabel = labelMap[k] || (UUID_RE.test(k) ? k.slice(0, 8) : k)
            const colVal =
              typeof v === 'object' && v !== null
                ? normalizeValueToString(v, '', labelMap)
                : String(v ?? '')
            return `${colLabel}: ${colVal}`
          })
          .join(' | ')
      )
      .join('\n')
  }

  // ── Object ───────────────────────────────────────────────────────────────────
  if (typeof val === 'object') {
    // Address
    if ('full_address' in val) return val.full_address as string
    if ('city' in val) {
      const parts = [val.street_address, val.city, val.state, val.postal_code].filter(Boolean)
      return parts.join(', ')
    }
    // File upload
    if ('url' in val) return (val.name || val.url) as string

    const entries = Object.entries(val).filter(([k]) => k !== '_id')
    // Single-value group → unwrap
    if (entries.length === 1) return String(entries[0][1] ?? '')

    // Generic object – resolve keys
    return entries
      .map(([k, v]) => {
        const colLabel = labelMap[k] || (UUID_RE.test(k) ? k.slice(0, 8) : k)
        return `${colLabel}: ${v}`
      })
      .join(' | ')
  }

  return String(val)
}
