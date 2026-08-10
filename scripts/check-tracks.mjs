// Guards the two ways lib/tracks.json can break the site:
//   1. a dead YouTube id  -> silence
//   2. a situation whose tags match no song -> silence
// Runs on every build.
import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync(new URL('../lib/tracks.json', import.meta.url), 'utf8'))
const { songs, events, manualModes } = data
const bad = []

if (!songs?.length) bad.push('no songs')
if (!events?.length) bad.push('no events')
if (!manualModes?.length) bad.push('no manualModes')

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const KNOWN_SPECIAL_DAYS = ['salary_day', 'appraisal_period']
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const seen = new Set()
for (const song of songs ?? []) {
  const where = `${song.id} (${song.title})`
  if (!song.youtubeId || song.youtubeId.length !== 11) bad.push(`${where}: not an 11-char YouTube id`)
  if (seen.has(song.id)) bad.push(`${where}: duplicate id`)
  if (!song.title || !song.artist) bad.push(`${where}: missing title or artist`)
  if (!song.tags?.length) bad.push(`${where}: no tags`)
  seen.add(song.id)
}

const matches = (tags) => songs.filter((song) => song.tags.some((tag) => tags.includes(tag)))

for (const event of events ?? []) {
  const where = `${event.id} (${event.title})`
  if (!event.tags?.length) bad.push(`${where}: no tags`)
  else if (matches(event.tags).length === 0) bad.push(`${where}: no song matches tags [${event.tags}]`)

  for (const day of event.days ?? []) if (!DAYS.includes(day)) bad.push(`${where}: unknown day "${day}"`)
  for (const day of event.specialDays ?? [])
    if (!KNOWN_SPECIAL_DAYS.includes(day)) bad.push(`${where}: unknown specialDay "${day}" — add it to lib/corporateEvent.ts`)

  if (event.time) {
    const { start, end } = event.time
    if (!TIME.test(start) || !TIME.test(end)) bad.push(`${where}: bad time "${start}"-"${end}"`)
    else if (start >= end) bad.push(`${where}: start is not before end`)
  } else if (!event.specialDays?.length) {
    bad.push(`${where}: needs either a time window or specialDays`)
  }
}

for (const mode of manualModes ?? []) {
  const where = `${mode.id} (${mode.label})`
  if (!mode.tags?.length) bad.push(`${where}: no tags`)
  else if (matches(mode.tags).length === 0) bad.push(`${where}: no song matches tags [${mode.tags}]`)
}

const results = await Promise.all(
  (songs ?? []).map(async ({ youtubeId, title }) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`
    try {
      const res = await fetch(url)
      return res.ok ? null : `${youtubeId} (${title}): HTTP ${res.status} — deleted, private or embed-disabled`
    } catch (err) {
      return `${youtubeId} (${title}): ${err.message}`
    }
  })
)
bad.push(...results.filter(Boolean))

if (bad.length) {
  console.error(`\n${bad.length} problem(s) in lib/tracks.json:`)
  for (const line of bad) console.error('  ✗ ' + line)
  process.exit(1)
}

console.log(`✓ ${songs.length} tracks playable, ${events.length} events and ${manualModes.length} moods all have songs`)
