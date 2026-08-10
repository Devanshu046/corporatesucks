# Corporate Life. On Loop.

An unofficial Indian corporate radio that knows what you're going through right
now. It reads the clock, works out which corporate situation you're in, and picks
a song by matching tags. Static Next.js, a hidden YouTube player, and one piece of
artwork doing all the talking.

No backend, no database, no auth, no runtime cost.

```
current time → current day → corporate event → title + subtitle → tag match → song
```

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # validates the playlist, then exports static HTML to out/
npm run check      # just the playlist validation
```

`npm run build` writes a fully static site to `out/`. Drop that on Vercel,
Cloudflare Pages, Netlify, or any dumb file host.

## The data

Everything lives in `lib/tracks.json` — songs, events and manual moods in one
file, three separate arrays:

```jsonc
{
  "songs":       [{ "id": "song_004", "youtubeId": "...", "title": "Zinda", "artist": "...",
                    "tags": ["production", "deadline", "urgent"] }],
  "events":      [{ "id": "event_007", "title": "PRODUCTION ISSUE", "subtitle": "...", "icon": "🚨",
                    "days": ["monday"], "time": { "start": "17:00", "end": "18:00" },
                    "tags": ["production", "urgent"] }],
  "manualModes": [{ "id": "mode_production", "label": "Everything Is On Fire", "icon": "🚨",
                    "tags": ["production", "urgent", "deadline"] }]
}
```

**Nothing ever names a song id.** Events and moods carry tags; songs carry tags;
the overlap decides what plays. So one song serves many situations, and adding a
song with the right tags makes it eligible everywhere immediately.

The `songs` array inside each event is **unused** — a leftover you can delete.
Selection is tag-based by design.

After editing, run `npm run check`. It verifies every YouTube id still plays and
that every event and mood matches at least one song, so no situation can end up
silent. It runs on every build too.

### Adding a song

Add it to `songs` with tags drawn from the vocabulary already in use, then
`npm run check`. That's it — no event needs touching.

### Adding an event

Add it to `events` with `days`, a `time` window and `tags`. Overlaps are fine and
expected; see the priority rule below.

## Rotating quotes

`lib/corporatequote.json` (`{ "corporateQuotes": [{ "text": "..." }] }`) is the only
source. Add a line there and it's in rotation — nothing else to touch.

`lib/useRotatingQuote.ts` picks a random quote every 3–4 seconds, fading out before
swapping the text so two lines never cross-fade into a smudge, and never repeats the
line already on screen. Timings are the three constants at the top of that file.

## Cover art and the scanner

Cover art comes straight from YouTube — `https://i.ytimg.com/vi/<youtubeId>/hqdefault.jpg`,
cropped to a circle and spun while playing. No build step, no files to manage.
If you'd rather have real square album art, that needs the iTunes Search API at
build time plus self-hosted images; say so and it's a small script.

The punch-in scanner is an inline SVG (`Fingerprint` in `app/page.tsx`) so there's
no asset to ship and it recolours with the theme. Swapping in your own artwork is
one line — replace the `<Fingerprint />` with an `<img src="/scanner.png" alt="" />`.

## Changing the artwork

Two images, picked by aspect ratio rather than width — that's what actually decides
how much of the illustration survives the `cover` crop:

| File | Used when | Source |
|---|---|---|
| `public/bg.webp` | landscape screens | `bg_pc.png` |
| `public/bg-mobile.webp` | any portrait screen (`max-aspect-ratio: 1/1`) | `bg_mobile.png` |

```bash
mkdir -p /tmp/bgout
npx sharp-cli -i bg_pc.png     -o /tmp/bgout -f webp -q 78 resize 1920
npx sharp-cli -i bg_mobile.png -o /tmp/bgout -f webp -q 78 resize 1080
cp /tmp/bgout/bg_pc.webp public/bg.webp
cp /tmp/bgout/bg_mobile.webp public/bg-mobile.webp
```

2.2MB → 222KB and 2.3MB → 223KB at those settings.

Neither current image has the site name lettered into it, so the wordmark only
appears on the punch-in gate.

`bg_pc.png` and `bg_mobile.png` are the full-resolution masters, kept so the webp
can be regenerated at a different quality. They are never deployed — only `public/`
and the build output ship.

## Deploying

```bash
npx vercel        # preview URL
npx vercel --prod # production
```

`output: 'export'` means Vercel serves it as plain static files — no serverless
functions, no runtime, free tier is plenty. `npm run build` runs the data validator
first, so a dead YouTube id fails the deploy rather than reaching production.

## Files

| File | What it is |
|---|---|
| `app/page.tsx` | The entire UI — gate, event, player, situation picker |
| `app/globals.css` | All the styling |
| `lib/corporateEvent.ts` | Which situation you're in right now |
| `lib/songSelection.ts` | Tag matching → a shuffled playlist |
| `lib/useYouTube.ts` | Hidden YouTube IFrame player |
| `lib/tracks.json` | Songs, events, manual moods |
| `scripts/check-tracks.mjs` | Data validator, runs on build |

## How a situation gets picked

Around ten events overlap at any given weekday minute, so the **most specific one
wins**, in this order:

1. A special day beats everything (Salary Day, Appraisal Season)
2. Then whichever event covers the fewest days — Friday Mode beats Deadline on a Friday
3. Then the narrowest time window — Production Issue (1h) beats Office Crush (5h) at 5pm

The resolved week, which you can change entirely from the data:

```
Mon      08:30 😵 Monday Survival · 10:00 💻 Work · 11:30 📞 Meeting · 12:30 ☕ Chai
         13:00 ❤️ Office Crush · 14:00 🥱 Post-Lunch · 15:30 ⏰ Deadline
         17:00 🚨 Production Issue · 18:00 🚪 Should I Leave · 19:00 🫠 Still Working
Tue–Thu  same, starting 08:30 💻 Work
Fri      … 15:30 ⏰ Deadline · 16:00 🎉 Friday Mode · 18:30 🏃 Network Abandoned
Sat/Sun  09:00 🕺 Weekend Has Entered The Chat
else     🌙 Office Is Closed
```

Two rules live in `lib/corporateEvent.ts` rather than the data, because they're
date maths rather than configuration — both marked and easy to retune:

- `salary_day` — the 1st of the month
- `appraisal_period` — the first week of April
- Special-day events have no time window, so they get the working day (09:00–19:00)
- `OFF_THE_CLOCK` — the fallback shown outside every configured window

The current event is re-checked every 20 seconds, so 4:59pm rolls into 5:00pm with
no refresh. The song only re-shuffles when the situation actually changes, so it
never swaps out mid-event.

## Things worth knowing

- **Audio is YouTube.** The player iframe is 1×1 and invisible, which is against
  YouTube's Terms of Service. Enforcement is rare, but the site is deletable on
  their whim. Self-hosting licensed MP3s is the way out if that matters.
- **The iframe must stay inside the viewport.** It's 1×1 and `opacity: 0` rather
  than parked at `left: -9999px`, because Chrome will not start media in an
  iframe rendered off-viewport.
- **Visitors without YouTube Premium may get ads** between tracks.
- **The online count is decorative.** It follows the workday curve so it never
  reads as frozen, but there is no backend and nobody is being counted.
- **Times are the visitor's local clock**, per spec — so a viewer in London sees
  London time. `app.timezone: "Asia/Kolkata"` in the data is therefore unused;
  say the word and it becomes forced IST in one line.
- **iOS pauses audio when the tab goes to the background.** Nothing to be done
  about that short of a native app.
- Playback needs one real click (the Punch In gate) — browsers refuse to autoplay
  audio, so the gate turns that requirement into the joke.
