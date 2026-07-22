/**
 * Question-size presets shared between the real public form renderer
 * (`StandaloneFormRenderer`) and the builder's editing canvas (`BlockEditor`),
 * so both apply identical label/input sizing for a given theme setting.
 */
export const QUESTION_SIZE_PRESETS: Record<string, { label: number; input: number }> = {
  small: { label: 13, input: 34 },
  normal: { label: 14, input: 38 },
  large: { label: 16, input: 44 },
}
