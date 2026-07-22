'use client'

import { useEffect } from 'react'
import { loadGoogleFont } from '@/lib/fonts'

/**
 * Injects/swaps the Google Fonts <link> for the given font key whenever it
 * changes. Shared by the Theme Designer panel (live preview while editing)
 * and the standalone form renderer (actual public render).
 */
export function useGoogleFont(fontKey: string | undefined) {
  useEffect(() => {
    loadGoogleFont(fontKey)
  }, [fontKey])
}
