Skyline Weather

Modern, reactive weather webapp with animated visuals (clear, clouds, drizzle, rain, snow, thunder, fog/haze). Built with plain HTML/CSS/JS — no build step.

Features
- Animated background effects that respond to conditions (2xx/3xx/5xx/6xx/7xx/800/80x).
- Current conditions card with wind direction arrow and optional UV index.
- Hourly chart (12 hours) with temperature line and precipitation probability overlay.
- 7‑day compact forecast with smooth item animations.
- Geolocation, city search, units toggle (metric/imperial), and optional OpenWeatherMap live data.

Requirements
- Any static HTTP server. Examples below use Python 3’s built‑in server.
- A modern browser (modules, canvas). No external build tools required.

Quick Start
1) Serve statically to avoid CORS:
   - Python: `python3 -m http.server 5173` then open http://localhost:5173/
2) Optional: Add your OpenWeatherMap API key (header → “API Key”) to enable live data.
   - Without a key, the app uses local mock data and still animates conditions.
3) Search for a city or click the geolocation button. Toggle units at any time.

Live Data (OpenWeatherMap)
- Geocoding: `https://api.openweathermap.org/geo/1.0/direct?q={city}&limit=1&appid={key}`
- One Call v3.0: `https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&units={units}&appid={key}`
- Units: `metric` (°C, m/s) or `imperial` (°F, mph)
- If your account doesn’t have access to One Call 3.0, switch to the Current + 5‑day (3h) API and adapt `assets/js/weather.js` accordingly.

Controls & Behavior
- Search: Type a city name and press Enter.
- Geolocate: Uses the browser’s geolocation API if permitted.
- Units: Toggle C°/F°; with an API key the app refetches, otherwise it converts locally.
- API key: Stored in localStorage; remove or change via the header dropdown.

Project Layout
- `index.html` – App shell and markup
- `assets/css/styles.css` – Styles and layout (glassmorphism + responsive rules)
- `assets/js/app.js` – UI state, event wiring, rendering, and chart drawing
- `assets/js/weather.js` – Weather data access and formatting (OWM + mock fallback)
- `assets/js/animations.js` – Fullscreen canvas animations mapped from condition codes
- `assets/mock/sample-weather.json` – Local mock data for offline/demo

What’s Implemented Recently
- Fog/Haze visual layer for 7xx codes (ambient drifting fog bands).
- Precipitation probability (POP) overlay on the hourly chart.
- UV index shown on the current card when available.
- Animated forecast list items on new searches.

Troubleshooting
- Blank or blocked requests when opening via file:// → Serve via localhost as shown above.
- No live data after entering an API key → Verify the key and plan access to One Call v3.0.
- Geolocation denied or unavailable → Use the search box; app falls back gracefully.

Testing Checklist
- Load without API key → mock data displays; chart renders; animations visible.
- Enter a city + API key → live data loads; background effects change if conditions differ.
- Toggle units → values update; with API key app refetches; otherwise converts locally.
- Resize window → hourly chart resizes and redraws.

License
- For demo and educational purposes. See AGENTS.md for technical notes and roadmap.

See AGENTS.md for implementation details and the roadmap.
