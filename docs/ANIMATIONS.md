# Anime.js update for the existing MessMate frontend

Latest animation pass: **10 September 2026 — repeat on scroll**. This ZIP is cumulative: apply it to the original MessMate source or either earlier animation update in the same project folder.

This update adds Anime.js 4.5.0 to the existing Next.js frontend. The current pages, shared components, authentication client, API contracts, database schema and Expo application are retained. Animation is a presentation layer; it does not manufacture attendance, estimates, device activity or successful requests.

## Apply the small frontend update ZIP

1. Stop the running development server with Ctrl+C.
2. Keep a backup of any frontend source edits you made locally after downloading MessMate.
3. Extract `messmate-animation-update.zip`. Copy its `apps` folder and `pnpm-lock.yaml` into your existing MessMate root folder (the folder containing `package.json`). Merge the folders and replace the included frontend files. Copy the included `docs` files if you want the updated guides. This package contains no private environment files, database files, credentials or mobile source.
4. From that same existing project root run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm dev
   ```

5. Open `http://localhost:3000` and sign in with your existing account. Refresh the browser if it has kept the old frontend open.

If the browser reports `Module not found: Can’t resolve animejs`, stop the server and run `pnpm --filter @messmate/web add animejs@4.5.0` from the same project root. Wait for it to finish successfully, then run `pnpm dev`. The updated manifest and lockfile are included; copying TypeScript files alone does not install dependencies.

No setup, migration or seed command is required for this frontend update. Keep your current root `.env`, `apps/mobile/.env`, `.demo-credentials.json`, `.data` directory and external database configuration. Do not extract a new application folder and point it at a new database. If you have made additional local frontend changes, merge the included source changes instead of replacing those edits blindly.

The complete source ZIP also contains this update and the earlier optional LAN fingerprint firmware update. Its `source-history.bundle` preserves the local Git checkpoints. The small frontend ZIP is sufficient for adding animations to the running project.

## Animation behavior

Scroll a section fully out of view, then return to it: its entrance plays again, whether you are scrolling up or down. Headings, individual dashboard/meal/feature cards, chart shapes, counters, table rows and the meal illustration all follow this behavior. A small buffer at the viewport edges prevents tiny scroll movements from repeatedly restarting an effect. Animations finish while a section remains visible; they do not loop continuously or take control of scrolling.

| Area | Behavior |
|---|---|
| Page entry | Masked word reveals for page headings and landing titles; section entrances replay when returning on scroll |
| Dashboard, meal and feature cards | Individual 620 ms scroll entrances with a bounded 75 ms stagger; KPI accent strokes and pointer lighting with limited 3D content tilt on devices with a fine pointer |
| KPI values | Count toward the actual API-derived value over 950 ms; another scroll visit counts from zero to the latest value. Unchanged values do not restart on each API refresh while visible |
| Waste, estimated savings and impact | Counters replay on returning to view; Indian number formatting, currency, units, precision and unavailable placeholders are preserved |
| Sidebar/navigation | Staggered link entrances and a moving active-item background; responsive drawer behavior retained |
| Attendance meals | Breakfast/Lunch/Dinner tabs use the existing meal filter and a sliding selected background; Arrow keys, Home and End work, with selected-tab and panel semantics |
| Tables | Individual row entrances replay on scroll, limited to the first 16 rows; sorting, pagination and table overflow remain intact |
| Charts | On each scroll visit, Anime.js draws the actual Recharts line/area paths and grows the actual bars from their baseline; axes, values, tooltips and data stay under Recharts control |
| Fingerprint requests | Fingerprint strokes draw in, a scan beam sweeps and two rings pulse during a real pending request or reported authentication; the effect stops after three cycles |
| Attendance success | Drawn confirmation check, expanding rings and six small fading dots, triggered by recorded attendance or an API-confirmed successful action |
| Fingerprint rejection | A small, single shake for assignment failures and the scanner's latest API-reported error |
| Buttons | Light sweep, hover/focus feedback and press compression; click handlers and disabled states are preserved |
| Dialogs | Brief scale/opacity entrance with existing Radix focus, positioning and dismissal retained |
| Landing illustration | A coordinated 3.7-second SVG path, moving light, dot wave and three meal-process cards; it repeats on returning to view or pressing its replay button |

Fingerprint pending/success/error feedback still follows the actual request or reported result. Scrolling does not simulate another scan, submit attendance or replay a success as if new attendance occurred.

## Hardware feedback is based on available evidence

The Fingerprints page reads `/admin/devices` every 20 seconds and displays the most recently active fingerprint scanner's last reported result. It includes the scanner name and last-seen time. `recorded` and `already_recorded` produce success feedback; stored HTTP errors such as 400, 404 and 409 produce rejection feedback. The existing backend already supplies these fields; no endpoint or backend change was needed.

This is a periodic view of the latest result, not a lossless stream of every scan. Rapid intermediate results can be replaced before the next refresh. A finger that fails to match locally never reaches the API, and authentication failures that cannot be attributed to an enabled scanner may not update its status. Those outcomes still need the ESP32's Serial Monitor or on-device feedback.

The Attendance page's Refresh button reads the existing attendance endpoint. Its status panel distinguishes loading, read failure, confirmed fingerprint rows and no matching rows for the selected filters. Confirmation refers to the currently loaded date, meal and page. Opening historical records does not imply a new scan occurred.

## Accessibility and cleanup

- The operating system's reduced-motion preference skips Anime.js movement and count-up effects, including changes to that preference while the page is open. Existing skeleton pulsing and navigation transitions also stop.
- Content and final numeric values are visible in server-rendered markup. Animation has no role in authorization, data fetching or making content available.
- Screen readers receive the final numeric value, rather than every animation frame. Printed output uses the exact final value as well.
- Visible status text accompanies fingerprint effects. Color and motion are supplemental cues.
- Effects use React cleanup, Anime.js scopes, observer disconnection and cancellation of active interactions. The page observer ignores counter text updates and SVG changes. Each section visit owns its animation scope; old runs are reverted and released rather than accumulating after many visits.
- Native IntersectionObservers trigger scroll entries and exits without a JavaScript handler running on every scroll event. The entry and exit boundaries have a small gap to avoid edge flicker, including on tall mobile sections.
- Scroll effects stop when their section leaves view or the browser tab becomes hidden, restoring fully visible content and exact counter values. They replay when the section becomes visible again. The illustration and scanner effects finish in under five seconds. No background animation runs indefinitely.
- The illustration is explanatory, not a live device display. Its replay button never sends an API request. It is disabled when the device requests reduced motion.
- A moving tab or sidebar indicator never controls selection: real buttons/links and their existing ARIA states remain authoritative. The selected background works without animation JavaScript. Rapid switching and viewport resizing are handled.
- SVG drawing begins from fully drawn baseline geometry so cleanup, reduced motion and replay leave icons and chart lines visible. Charts animate up to 80 bars, tables up to 16 rows, and the decorative dot wave has 40 dots.
- KPI tilt is limited to 3.5 degrees per axis and disabled on touch/coarse-pointer devices. It moves an inner presentation surface, leaving the card layout fixed.

## Main frontend files

- `apps/web/components/motion.tsx`: scoped section reveals, reduced-motion handling, shared entrances, numeric interpolation and delegated micro-interactions.
- `apps/web/components/scroll-replay.ts`: shared repeat-entry/exit observation, edge buffer and tab-visibility cleanup.
- `apps/web/components/landing-motion.tsx`: the explanatory meal illustration and replay timeline.
- `apps/web/components/chart-motion.tsx`: on-view motion for existing Recharts SVG shapes.
- `apps/web/components/fingerprint-feedback.tsx`: real request/result states and latest scanner activity.
- `apps/web/components/meal-tabs.tsx`: accessible meal selection and panel transition.
- Existing `ui.tsx`, `shell.tsx`, dashboard, attendance, student, fingerprint and report components use these shared helpers.
- `apps/web/app/globals.css`: restrained styling, responsive tabs, success/error indicators and reduced-motion/print behavior.

The implementation follows the [Anime.js React integration guidance](https://animejs.com/documentation/getting-started/using-with-react/) and [scope lifecycle](https://animejs.com/documentation/scope/), plus its [timeline](https://animejs.com/documentation/timeline/) and [SVG tools](https://animejs.com/documentation/svg/). Anime.js is installed locally and bundled with the website; no animation CDN or paid service is required.

## Verify after applying locally

Run `pnpm --filter @messmate/web typecheck`, `pnpm lint` and `pnpm --filter @messmate/web build`. In a browser, scroll down and back up several times: check the hero, headings, cards, chart lines, row entrances and counters. Small scroll movements while a section remains on screen should not restart it. Check administrator and student sign-in, a saved meal preference, attendance meal switching, the mobile sidebar, a rejected duplicate fingerprint assignment and the operating system's reduced-motion setting. The existing `pnpm test` command remains available for backend/domain regression checks. See VERIFICATION.md for the checks actually executed in the build environment.
