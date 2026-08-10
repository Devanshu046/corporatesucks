'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<any> | null = null

/** Injects the YouTube IFrame API once per page, no matter how many callers. */
function loadApi(): Promise<any> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiPromise
}

export type Progress = { current: number; duration: number }

type Options = {
  initialVideoId: string
  onEnded: () => void
  /** Fired when a video is deleted, private, region-blocked or embed-disabled. */
  onError: () => void
}

export function useYouTube({ initialVideoId, onEnded, onError }: Options) {
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)

  // Keep the latest callbacks without re-creating the player on every render.
  const endedRef = useRef(onEnded)
  const errorRef = useRef(onError)
  endedRef.current = onEnded
  errorRef.current = onError

  useEffect(() => {
    // The first track depends on the current corporate event, which is only
    // known after mount — so hold off until there is something to seed with.
    if (!initialVideoId) return
    let cancelled = false

    loadApi().then((YT) => {
      if (cancelled || !mountRef.current || playerRef.current) return
      // Seed with the first track: a player built without a videoId renders as
      // a bare /embed/ frame that loadVideoById() can never populate.
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: initialVideoId,
        playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e: any) => {
            const state = window.YT.PlayerState
            if (e.data === state.PLAYING) setPlaying(true)
            else if (e.data === state.PAUSED) setPlaying(false)
            else if (e.data === state.ENDED) endedRef.current()
          },
          onError: () => errorRef.current(),
        },
      })
    })

    return () => {
      cancelled = true
    }
    // Re-runs only until a seed id arrives; the playerRef guard keeps it to one player.
  }, [initialVideoId])

  const load = useCallback((videoId: string) => {
    playerRef.current?.loadVideoById(videoId)
  }, [])

  const toggle = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (playing) player.pauseVideo()
    else player.playVideo()
  }, [playing])

  const seekToFraction = useCallback((fraction: number) => {
    const player = playerRef.current
    const duration = player?.getDuration?.()
    if (duration) player.seekTo(duration * fraction, true)
  }, [])

  const getProgress = useCallback((): Progress => {
    const player = playerRef.current
    return {
      current: player?.getCurrentTime?.() ?? 0,
      duration: player?.getDuration?.() ?? 0,
    }
  }, [])

  return { mountRef, ready, playing, load, toggle, seekToFraction, getProgress }
}
