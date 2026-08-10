'use client'

import { useEffect, useState } from 'react'
import data from '@/lib/corporatequote.json'

/** Module-level so the array identity is stable and the effect below never re-runs. */
const QUOTES: string[] = data.corporateQuotes.map((quote) => quote.text)

const HOLD_MIN_MS = 3000
const HOLD_MAX_MS = 4000
const FADE_MS = 400

function pickOther(current: number | null) {
  if (QUOTES.length <= 1) return 0
  let next = Math.floor(Math.random() * QUOTES.length)
  // Never show the same line twice in a row — it reads as a broken timer.
  while (next === current) next = Math.floor(Math.random() * QUOTES.length)
  return next
}

/**
 * Rotates a random corporate one-liner, fading out before swapping the text so
 * the two never cross-fade into an unreadable smudge.
 */
export function useRotatingQuote() {
  const [index, setIndex] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (QUOTES.length === 0) return
    let holdTimer = 0
    let fadeTimer = 0

    const show = () => {
      setIndex(pickOther)
      setVisible(true)
      holdTimer = window.setTimeout(() => {
        setVisible(false)
        fadeTimer = window.setTimeout(show, FADE_MS)
      }, HOLD_MIN_MS + Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS))
    }

    show()
    return () => {
      window.clearTimeout(holdTimer)
      window.clearTimeout(fadeTimer)
    }
  }, [])

  // null until mounted: a random first quote would not survive hydration.
  return { quote: index === null ? null : QUOTES[index], visible }
}
