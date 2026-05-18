# Giant Bomb LGTV

An unofficial LG webOS TV app for watching [Giant Bomb](https://www.giantbomb.com) videos. Sister project to [Giant Bomb TV](https://github.com/Clinteastman/GiantBombTV) (Android TV and mobile); ports the same browsing, search, watchlist, continue-watching, and playback experience to LG smart TVs.

> **Disclaimer:** This is a fan-made, unofficial app. It is not affiliated with or endorsed by Giant Bomb. All Giant Bomb content is property of its respective owners.

## Status

Early. Working in dev: setup with API key, browse with the same row order as the Android app, show drill-down, search, detail screen, HLS playback with quality picker, progress sync. Not yet built: pinned-show pinning UI, customize-browse, splash screen, on-device QA.

## Tech stack

- **Vite + React 18 + TypeScript** for the SPA
- **`@noriginmedia/norigin-spatial-navigation`** for D-pad focus management
- **`@tanstack/react-query`** for HTTP caching and request dedup
- **`hls.js`** for HLS playback in the WebView's `<video>` element
- **`@webosose/ares-cli`** (host machine only) for packaging and installing on a real LG TV

Pure-TS code (`src/lib/`) has no React imports, so the Giant Bomb API client, types, Twitch live-status helper, upcoming-feed resolver, and quality-selection logic can be lifted into any other JS or TS frontend later (e.g. an Xbox PWA via Edge, or a React Native target via `react-native-windows`).

## Local development

```bash
npm install
npm run dev          # http://localhost:5173 (also bound on LAN)
```

The Vite dev server proxies `/gb/*` to `https://giantbomb.com` and sets `User-Agent: GBTV`, which is the UA that Giant Bomb's Cloudflare zone whitelists. Without that header, server-side requests intermittently hit a 403 challenge page (especially on `/upcoming_json`).

On first launch, enter a Giant Bomb API key from <https://www.giantbomb.com/api/>.

## Building the IPK

```bash
npm run build        # vite build → dist/
npm run package      # ares-package dist -o build  → build/com.giantbomb.tv.webos_0.1.0_all.ipk
```

`appinfo.json`, `icon.png`, and `icon-large.png` live under `public/`, so the build copies them to the root of `dist/`, where `ares-package` expects them.

## Testing on a real LG TV

The full workflow takes ~20 minutes the first time. Subsequent installs are seconds.

### One-time setup

1. **Make an LG developer account** at <https://webostv.developer.lge.com> (free).
2. **Enable Developer Mode on the TV:**
   - On the TV, open the **LG Content Store** → search **Developer Mode** → install.
   - Open the Developer Mode app, sign in with your LG dev account.
   - Toggle **Dev Mode Status → On**. The TV reboots into a 50-hour dev session (auto-renews while you keep using it).
   - After reboot, open Developer Mode again and toggle **Key Server → On**. Note the IP shown.
3. **Install the LG ares CLI** on this machine:
   ```bash
   npm i -g @webosose/ares-cli
   ```
4. **Pair the TV:**
   ```bash
   ares-setup-device                        # interactive: add a device named "tv" with the TV's IP
   ares-novacom --device tv --getkey        # fetches the per-session passphrase
   ```
   Setup will ask for the TV's IP, the SSH port (default `9922`), and the passphrase from the previous command.

### Build, install, launch

```bash
npm run build         # produces dist/
npm run package       # wraps dist/ into build/com.giantbomb.tv.webos_0.1.0_all.ipk
npm run install-tv    # ares-install --device tv build/*.ipk
npm run launch-tv     # ares-launch --device tv com.giantbomb.tv.webos
```

After `install-tv`, the app appears in the TV's launcher row.

### Debug a running app on the TV

```bash
ares-inspect --device tv --app com.giantbomb.tv.webos --open
```

A Chromium DevTools window opens on your dev machine, attached to the live app on the TV. Live console, network panel, breakpoints — everything works as if the app were running locally.

### Fast-iteration: live dev server on the TV

Skip the package/install loop while you're actively coding. Run the dev server here and point the TV at it:

```bash
npm run dev                                                      # this machine, port 5173
ares-launch --device tv --hosted http://<this-machine-ip>:5173/  # TV loads the dev URL
```

Hot-reload works on the TV. Same network required.

### Gotchas

- **Dev Mode sessions expire after 50 hours.** The Developer Mode app shows the remaining counter. Keep using the TV to auto-renew.
- **Self-signed IPKs are dev-only.** A permanent install or public distribution goes through LG Content Store submission, which is a separate, slower process.
- **DHCP lease changes** can break `ares-install`. If it fails with "Device not found," re-check the TV's IP in the Developer Mode app and update via `ares-setup-device`.
- **Older webOS (3.x and earlier)** ships an older WebKit. Test there if you care about coverage; modern features may not all work.

## Project structure

```
src/
├── lib/             Platform-free TS. Reusable in any JS frontend.
│   ├── api/         Giant Bomb client + types, Twitch live-status check
│   ├── auth/        API key storage (localStorage)
│   ├── playback/    Quality-resolution logic
│   └── upcoming/    Pure resolver for live/upcoming feed
├── hooks/           Platform-coupled React hooks (useInView for lazy images)
├── components/      Cards (Video, Show, Upcoming), Row, LazyShowRow
├── screens/         Setup, Browse, Detail, Playback, Search, ShowBrowse
├── styles/          Global CSS
└── assets/          In-app images (wordmark, etc.)
public/
├── appinfo.json     webOS app manifest (copied to .ipk root)
├── icon.png         Launcher tile (copied to .ipk root)
└── icon-large.png   Larger launcher variant
```

## Acknowledgments

Giant Bomb is independent and worth supporting. If you use this app and get value from it, [join Premium](https://giantbomb.com/get-premium).
