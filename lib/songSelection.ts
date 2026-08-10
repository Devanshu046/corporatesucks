import data from '@/lib/tracks.json'

export type Track = (typeof data.songs)[number]

export const songs: Track[] = data.songs

/**
 * Songs are matched to a situation purely by tag overlap — no event ever names
 * a song id, so the same track can turn up for Deadline and for Production Issue.
 * Best-matching songs come first, ties are shuffled, and the whole list is
 * returned so the player's next/prev can walk it.
 */
export function playlistFor(tags: string[]): Track[] {
  const scored = songs
    .map((song) => ({ song, score: song.tags.filter((tag) => tags.includes(tag)).length }))
    .filter((entry) => entry.score > 0)

  // Nothing tagged for this situation: everything is fair game rather than silence.
  const pool = scored.length > 0 ? scored : songs.map((song) => ({ song, score: 0 }))

  return pool
    .map((entry) => ({ ...entry, roll: Math.random() }))
    .sort((a, b) => b.score - a.score || a.roll - b.roll)
    .map((entry) => entry.song)
}
