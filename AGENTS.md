Skyline Weather — Agent Guide

Overview
- Goal: A modern, reactive weather webapp with animated visuals that respond to forecast (rain, snow, thunder, clouds, clear).
- Stack: Static HTML/CSS/JS (no build step). Canvas-based animations. Optional live data via OpenWeatherMap; mock fallback included.
- Entry point: index.html

Project Structure
- index.html: App shell, header controls, sections, and the animation canvas overlay.
- assets/css/styles.css: Glassmorphism UI, layout, gradients, responsive rules.
- assets/js/app.js: UI state, event wiring, rendering logic, and charts.
- assets/js/weather.js: Weather data access. Uses OWM if API key is present; falls back to mock JSON.
- assets/js/animations.js: Fullscreen canvas animation engine for condition-driven effects.
- assets/mock/sample-weather.json: Local mock data compatible with the formatter in weather.js.

How It Works
1) On load, the app attempts geolocation; otherwise it uses the last searched city (default San Francisco).
2) If an OpenWeatherMap API key is provided (header → API Key), the app will use OWM’s Geocoding + One Call v3.0 endpoints. If any fetch fails (or no key is set), it falls back to the mock JSON.
3) The UI renders:
   - Current card: temp, description, feels-like, wind, humidity, time, place.
   - Hourly panel: next 12 hours line chart (canvas, no library).
   - 7-Day forecast: compact list with emoji icons.
4) The animation engine maps weather condition IDs → effects:
   - 2xx → thunder flashes + rain
   - 3xx → drizzle
   - 5xx → rain
   - 6xx → snow
   - 800 → clear ambience
   - 80x → drifting clouds

Local Development
- Serve statically to avoid CORS: e.g. `python3 -m http.server 5173` and open http://localhost:5173/
- Optional: Add your OpenWeatherMap key in the header dropdown. Units toggle persists in localStorage.
- Without a key, the app displays mock data and still animates conditions.

Data Sources (Live)
- Geocoding: https://api.openweathermap.org/geo/1.0/direct?q={city}&limit=1&appid={key}
- One Call v3.0: https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&units={units}&appid={key}
  - Units: `metric` (°C, m/s) or `imperial` (°F, mph)

Key Conventions
- No external build tools: keep code ES modules and browser-native.
- UI: glass surfaces (class `glass`), accent gradient buttons, subtle backgrounds.
- Animations are non-blocking and drawn on `#fx-canvas` with requestAnimationFrame.
- Emoji icons are used to avoid bundling assets; can be replaced with SVG later.

Extending Animations
- File: assets/js/animations.js
- Add a new enum in CONDITIONS and map in setCondition.
- For particle effects, push objects into `this.particles` with the required fields and update behavior in draw().
- For ambience (e.g., fog), draw translucent layers before/after particles.

Recent Changes
- Added fog/haze ambience for 7xx codes via drifting translucent bands.
- Added precipitation probability (hourly POP) overlay to the chart.
- Added UV index to current card when provided by API.
- Animated forecast list items on new searches.

UI Enhancements (Ideas)
- Add precipitation probability overlay to the hourly chart.
- Animate card transitions when switching cities or units.
- Add wind direction arrow and sunrise/sunset chips.
- Introduce SVG icon set with themed color accents.

Error Handling
- Live fetches are wrapped; on failure, the module falls back to mock data and logs a warning.
- Basic in-UI failures are minimized by resilient render functions with defaults.

Testing Checklist
- Load without API key → mock data displays; chart renders; animations visible.
- Enter a city + API key → live data loads; background effects change if conditions differ.
- Toggle units → values update; with API key we refetch; without, we convert locally.
- Resize window → hourly chart resizes and redraws.

Known Limitations
- One Call v3.0 availability may depend on the OWM plan. If unavailable, switch to Current + 5-day (3h) API and adapt formatting.
- CORS from file:// may block fetch; serve via localhost as noted above.

Roadmap / TODOs
1) Replace emoji with an inline SVG icon set.
2) Add a city suggestions dropdown via geocoding autocomplete.
3) Add offline-first caching of the last successful live response.

Agent Notes
- Keep changes focused and minimal; do not introduce build tooling unless explicitly requested.
- If adding features, update this file and the README succinctly.
- Prefer progressive enhancement: ensure the app remains usable without live data.
