'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAttendanceNote,
  getCurrentCorporateEvent,
  getManualSituation,
  manualModes,
  type Situation,
} from '@/lib/corporateEvent'
import { useRotatingQuote } from '@/lib/useRotatingQuote'
import { playlistFor, type Track } from '@/lib/songSelection'
import { useYouTube, type Progress } from '@/lib/useYouTube'

/** Give up rather than spin through a playlist of dead videos. */
const MAX_CONSECUTIVE_ERRORS = 3

/** How often to notice that 4:59pm became 5:00pm. */
const EVENT_POLL_MS = 20_000

export default function Page() {
  const [situation, setSituation] = useState<Situation | null>(null)
  const [manualId, setManualId] = useState<string | null>(null)
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [index, setIndex] = useState(0)
  const [punchedIn, setPunchedIn] = useState(false)
  const [dead, setDead] = useState(false)
  const errorsRef = useRef(0)

  const track = playlist[index]

  // AUTO: follow the clock, and notice when one event rolls into the next.
  // Runs only while no manual situation is pinned.
  useEffect(() => {
    if (manualId) return
    const tick = () => {
      const next = getCurrentCorporateEvent(new Date())
      setSituation((current) => (current?.id === next.id ? current : next))
    }
    tick()
    const id = window.setInterval(tick, EVENT_POLL_MS)
    return () => window.clearInterval(id)
  }, [manualId])

  // A new situation means a new shuffle. Staying inside the same one does not,
  // so the song never changes out from under the listener mid-event.
  useEffect(() => {
    if (!situation) return
    setPlaylist(playlistFor(situation.tags))
    setIndex(0)
  }, [situation])

  const go = useCallback((delta: number) => {
    setIndex((i) => (playlist.length === 0 ? 0 : (i + delta + playlist.length) % playlist.length))
  }, [playlist.length])

  const { mountRef, ready, playing, load, toggle, seekToFraction, getProgress } = useYouTube({
    initialVideoId: playlist[0]?.youtubeId ?? '',
    onEnded: () => {
      errorsRef.current = 0
      go(1)
    },
    onError: () => {
      // Deleted, private, region-locked or embed-disabled: skip it.
      errorsRef.current += 1
      if (errorsRef.current >= MAX_CONSECUTIVE_ERRORS) setDead(true)
      else go(1)
    },
  })

  // A track that actually plays clears the dead-video streak.
  useEffect(() => {
    if (playing) errorsRef.current = 0
  }, [playing])

  // Skip the first load: the player is already seeded with playlist[0].
  const seeded = useRef<string | null>(null)
  useEffect(() => {
    if (!track) return
    if (seeded.current === null) {
      seeded.current = track.youtubeId
      return
    }
    if (seeded.current === track.youtubeId) return
    seeded.current = track.youtubeId
    load(track.youtubeId)
  }, [track, load])

  const pickSituation = (modeId: string) => {
    const picked = getManualSituation(modeId)
    if (!picked) return
    setManualId(modeId)
    setSituation(picked)
    if (punchedIn) setDead(false)
  }

  const backToAuto = () => {
    setManualId(null)
    setDead(false)
  }

  return (
    <>
      <div ref={mountRef} className="yt-host" />

      <Clock />
      <Online />

      <main className="stage">
        <div className="stage-top">
          <Quote />

          <div className="event">
            <div className="event-icon">{situation?.icon ?? '⏳'}</div>
            <h1 className="event-title">{situation?.title ?? 'Clocking In'}</h1>
            <p className="event-sub">{situation?.subtitle ?? 'Working out what you are going through.'}</p>
          </div>
        </div>

        <div className="stage-bottom">
          <div className="player">
          <div className={`cover${playing ? ' cover--spin' : ''}`}>
            {track && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`}
                alt=""
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
            )}
          </div>

          <div className="meta">
            <div className="track-title">{track?.title ?? '—'}</div>
            <div className="track-artist">{track?.artist ?? ''}</div>
            <Scrub getProgress={getProgress} onSeek={seekToFraction} />
          </div>

          <div className="controls">
            <button className="ctrl" onClick={() => go(-1)} disabled={!ready} aria-label="Previous track">
              <svg viewBox="0 0 24 24">
                <path d="M6 5h2v14H6zm3 7 9-7v14z" />
              </svg>
            </button>

            <button
              className="ctrl ctrl--play"
              onClick={toggle}
              disabled={!ready}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg viewBox="0 0 24 24">
                  <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M8 5l12 7-12 7z" />
                </svg>
              )}
            </button>

            <button className="ctrl" onClick={() => go(1)} disabled={!ready} aria-label="Next track">
              <svg viewBox="0 0 24 24">
                <path d="M16 5h2v14h-2zM6 5l9 7-9 7z" />
              </svg>
            </button>
          </div>

        </div>

        {manualId && (
          <button className="mode-reset" onClick={backToAuto}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7z" />
              <path d="M12 7v5l3.5 2 1-1.7L13.5 11V7z" />
            </svg>
            Back to the clock
          </button>
        )}

        {dead && <div className="dead">Too many dead tracks in a row. Someone check the playlist.</div>}

        <section className="situations">
          <h2>What&rsquo;s your corporate situation?</h2>
          <div className="chips">
            {manualModes.map((mode) => (
              <button
                key={mode.id}
                className={`chip${manualId === mode.id ? ' chip--on' : ''}`}
                onClick={() => pickSituation(mode.id)}
              >
                <span aria-hidden>{mode.icon}</span>
                {mode.label}
              </button>
            ))}
            </div>
          </section>
        </div>
      </main>

      {!punchedIn && (
        <div className="gate">
          <div className="gate-inner">
            <div className="gate-kicker">Attendance is mandatory</div>
            <h1 className="gate-title">Corporate Life. On Loop.</h1>
            <p className="gate-sub">Back-to-back calls, one chai, and a playlist that gets it.</p>

            <button
              className="scanner"
              onClick={() => {
                setPunchedIn(true)
                toggle()
              }}
              disabled={!ready}
              aria-label="Punch in"
            >
              <Fingerprint />
            </button>
            <p className="scanner-label">{ready ? 'Place finger to punch in' : 'Booting the biometric machine…'}</p>
            <AttendanceNote />
          </div>
        </div>
      )}
    </>
  )
}

function Quote() {
  const { quote, visible } = useRotatingQuote()

  return (
    <p className={`quote${visible ? ' quote--in' : ''}`} aria-live="polite">
      {quote && `“${quote}”`}
    </p>
  )
}

/** Client-only: the note depends on the clock, which the prerender can't know. */
function AttendanceNote() {
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => setNote(getAttendanceNote(new Date())), [])
  return <p className="scanner-note">{note ?? ''}</p>
}

/** Swap this for an <img> if you'd rather supply your own scanner artwork. */
function Fingerprint() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
      <path d="M4.1 8.4A9 9 0 0 1 12 3.6a9 9 0 0 1 4.7 1.3" />
      <path d="M19.4 7.3A9 9 0 0 1 20.9 12c0 1.1-.1 2.2-.3 3.3" />
      <path d="M5.5 15.8c.4-1.2.6-2.5.6-3.8a6 6 0 0 1 11.5-2.4" />
      <path d="M18.2 12.8c.1 1.6 0 3.2-.4 4.8" />
      <path d="M7.4 18.7A16 16 0 0 0 9 12a3 3 0 0 1 6 0c0 1.6-.1 3.1-.4 4.6" />
      <path d="M9.7 20.2c.8-2.5 1.2-5.2 1.2-7.9a1.1 1.1 0 0 1 2.2 0c0 1.1 0 2.2-.1 3.3" />
      <path d="M12.5 19.2c-.2 1-.4 1.9-.7 2.8" />
    </svg>
  )
}

function Scrub({
  getProgress,
  onSeek,
}: {
  getProgress: () => Progress
  onSeek: (fraction: number) => void
}) {
  const [{ current, duration }, set] = useState<Progress>({ current: 0, duration: 0 })

  // Poll the player instead of re-rendering the page on every tick.
  useEffect(() => {
    let lastCurrent = -1
    let lastDuration = -1
    const id = window.setInterval(() => {
      const next = getProgress()
      if (next.current !== lastCurrent || next.duration !== lastDuration) {
        lastCurrent = next.current
        lastDuration = next.duration
        set(next)
      }
    }, 400)
    return () => window.clearInterval(id)
  }, [getProgress])

  const fraction = duration > 0 ? current / duration : 0

  return (
    <>
      <div
        className="scrub"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
        }}
      >
        <div className="scrub-rail">
          <div className="scrub-fill" style={{ width: `${fraction * 100}%` }} />
        </div>
      </div>
      <div className="times">
        {formatTime(current)} / {formatTime(duration)}
      </div>
    </>
  )
}

function Clock() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return <div className="badge badge--time">{time ?? ' '}</div>
}

function Online() {
  const [count, setCount] = useState<number | null>(null)

  // Decorative, like the sites this borrows from — no backend, no websocket.
  // It just tracks the workday so it never reads as a frozen number.
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      // Peaks around 4pm, bottoms out at 4am.
      const workday = Math.sin(((now.getHours() - 4) / 24) * Math.PI * 2)
      setCount(Math.max(3, Math.round(34 + workday * 26 + (now.getMinutes() % 7))))
    }
    tick()
    const id = window.setInterval(tick, 20_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="badge badge--online" aria-live="polite">
      <span className="dot" />
      <span>{count ?? '—'}</span>
      <span className="muted">online</span>
    </div>
  )
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
