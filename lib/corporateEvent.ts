import data from '@/lib/tracks.json'

export type Situation = {
  id: string
  icon: string
  title: string
  subtitle: string
  tags: string[]
}

type RawEvent = (typeof data.events)[number]

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Events keyed to specialDays carry no time window, so they get the working day. */
const SPECIAL_DAY_WINDOW = { start: '09:00', end: '19:00' }

// ponytail: salary lands on the 1st and appraisals run the first week of April.
// Both are guesses at Indian corporate norms — tune the numbers, not the logic.
const SPECIAL_DAYS: Record<string, (date: Date) => boolean> = {
  salary_day: (date) => date.getDate() === 1,
  appraisal_period: (date) => date.getMonth() === 3 && date.getDate() <= 7,
}

/** Shown outside every configured window — nights, and weekend mornings. */
const OFF_THE_CLOCK: Situation = {
  id: 'event_off_the_clock',
  icon: '🌙',
  title: 'Office Is Closed',
  subtitle: 'Nobody is watching. Standup is still at 9:30.',
  tags: ['late-night', 'escape', 'freedom', 'chill'],
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

const windowOf = (event: RawEvent) => ('time' in event && event.time ? event.time : SPECIAL_DAY_WINDOW)

function isActive(event: RawEvent, date: Date) {
  if (!event.days.includes(DAYS[date.getDay()])) return false

  const special = 'specialDays' in event ? event.specialDays : undefined
  if (special && !special.some((day) => SPECIAL_DAYS[day]?.(date))) return false

  const { start, end } = windowOf(event)
  const now = date.getHours() * 60 + date.getMinutes()
  return now >= toMinutes(start) && now < toMinutes(end)
}

/**
 * Roughly ten events overlap at any weekday minute, so the most *specific* one
 * wins: a special day beats everything, then the event covering the fewest days
 * (Friday Mode over Deadline on a Friday), then the narrowest time window
 * (Production Issue over Office Crush at 5pm).
 */
function specificity(event: RawEvent): [number, number, number] {
  const { start, end } = windowOf(event)
  const isSpecial = 'specialDays' in event && event.specialDays ? 0 : 1
  return [isSpecial, event.days.length, toMinutes(end) - toMinutes(start)]
}

const normalise = (event: RawEvent): Situation => ({
  id: event.id,
  icon: event.icon,
  title: event.title,
  subtitle: event.subtitle,
  tags: event.tags,
})

export function getCurrentCorporateEvent(date: Date): Situation {
  const active = data.events.filter((event) => isActive(event, date))
  if (active.length === 0) return OFF_THE_CLOCK

  active.sort((a, b) => {
    const [sa, da, wa] = specificity(a)
    const [sb, db, wb] = specificity(b)
    return sa - sb || da - db || wa - wb
  })

  return normalise(active[0])
}

// ponytail: one shift start for everyone. Split per-day if that ever matters.
const SHIFT_START_MINUTES = 9 * 60 + 30

/**
 * The line under the fingerprint scanner. Reads the clock and works out how much
 * trouble you're in, the way the machine at the office door silently does.
 */
export function getAttendanceNote(date: Date): string {
  const day = date.getDay()
  if (day === 0 || day === 6) return 'It is the weekend. Punching in is a choice you made.'

  const minutesLate = date.getHours() * 60 + date.getMinutes() - SHIFT_START_MINUTES

  if (minutesLate < -45) return 'You are early. Nobody will notice this either.'
  if (minutesLate < 1) return 'On time. Somebody take a screenshot.'
  if (minutesLate === 1) return 'You are 1 minute late. It has been noted.'
  if (minutesLate <= 15) return `You are ${minutesLate} minutes late. It has been noted.`
  if (minutesLate <= 60) return `${minutesLate} minutes late. This is now a half day.`
  if (minutesLate <= 240) return `${Math.round(minutesLate / 60)} hours late. Half day, obviously.`
  if (date.getHours() < 21) return 'Half the day is gone. Marked present anyway.'
  return 'Punching in at this hour. Respect, and some concern.'
}

export const manualModes = data.manualModes

/**
 * A manual pick borrows its subtitle from whichever event shares the most tags,
 * so "Office Crush" still reads "The only reason you don't hate Mondays."
 */
export function getManualSituation(modeId: string): Situation | null {
  const mode = data.manualModes.find((m) => m.id === modeId)
  if (!mode) return null

  const overlap = (event: RawEvent) => event.tags.filter((tag) => mode.tags.includes(tag)).length
  const closest = [...data.events].sort((a, b) => overlap(b) - overlap(a))[0]

  return {
    id: mode.id,
    icon: mode.icon,
    title: mode.label,
    subtitle: overlap(closest) > 0 ? closest.subtitle : '',
    tags: mode.tags,
  }
}
