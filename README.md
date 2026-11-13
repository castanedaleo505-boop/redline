# Redline

Six-day shoulders and arms split with set tracking, weight progression, deload weeks and a rest timer.
Works offline. All data stays on the phone it runs on.

- **Workout / Progress / Locked in**: sets, weights, charts, weekly score, weekly boss, streak.
- **Check-in**: monthly front, side and back photos with a self-timer, a 12-month record, body numbers and a before/after slider. The app reminds you when the month has no check-in.
- **Character**: a stylized figure drawn on the phone from your logged sets, with levels, gear, titles and your name on it. The Locker changes its colors and outfit. No photo, scan, account or paid service is involved.
- **Inside Progress**: estimated one-rep max and milestones per lift, a body-weight goal with a trend line and projected date, a training calendar heat map and a monthly report card.
- **Inside Locked in**: a trophy wall and Excuse court.
- **Anywhere**: Backup & restore saves one file with everything, photos included. Share buttons make an image on the phone. Plate math tells you what to load.

Open the live page on an iPhone in Safari, tap Share, then Add to Home Screen.

When any file changes, bump `CACHE` in `sw.js` and `APP_VERSION` in `app.js` so phones pick up the new version.

Run the tests with `node tests/run.js` (needs Node and Playwright with Chromium). They start their own local server.
