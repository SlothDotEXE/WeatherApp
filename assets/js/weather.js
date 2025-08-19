// Weather data module
// Tries OpenWeatherMap if apiKey is provided; falls back to local mock JSON

const OWM = {
  geo: (q, limit = 1, key) => `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=${limit}&appid=${key}`,
  onecall: (lat, lon, units, key) => `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`
};

async function fetchJson(url, { timeout = 9000 } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function findCoordsByCity(city, apiKey) {
  const geo = await fetchJson(OWM.geo(city, 1, apiKey));
  if (!geo?.length) throw new Error('City not found');
  const { lat, lon, name, country, state } = geo[0];
  return { lat, lon, name, country, state };
}

function mapConditionFromId(id) {
  if (id >= 200 && id < 300) return 'thunder';
  if (id >= 300 && id < 400) return 'drizzle';
  if (id >= 500 && id < 600) return 'rain';
  if (id >= 600 && id < 700) return 'snow';
  if (id >= 700 && id < 800) return 'fog';
  if (id === 800) return 'clear';
  if (id > 800 && id < 900) return 'clouds';
  return 'none';
}

function formatWeather(onecall, place, units) {
  const tzOffset = (onecall.timezone_offset || 0) * 1000;
  const now = new Date((onecall.current.dt * 1000) + tzOffset);
  const current = {
    dt: now,
    temp: Math.round(onecall.current.temp),
    feels_like: Math.round(onecall.current.feels_like),
    humidity: onecall.current.humidity,
    wind_speed: Math.round(onecall.current.wind_speed),
    wind_deg: onecall.current.wind_deg,
    uvi: onecall.current.uvi,
    weather: onecall.current.weather?.[0] || { id: 800, description: 'Clear', main: 'Clear' },
    units
  };

  const hourly = (onecall.hourly || []).slice(0, 12).map(h => ({
    dt: new Date((h.dt * 1000) + tzOffset),
    temp: Math.round(h.temp),
    pop: typeof h.pop === 'number' ? Math.max(0, Math.min(1, h.pop)) : undefined,
    weather: h.weather?.[0]
  }));

  const daily = (onecall.daily || []).slice(0, 7).map(d => ({
    dt: new Date((d.dt * 1000) + tzOffset),
    temp: { min: Math.round(d.temp.min), max: Math.round(d.temp.max) },
    weather: d.weather?.[0]
  }));

  const location = {
    name: place?.name ?? onecall.timezone ?? '—',
    region: [place?.state, place?.country].filter(Boolean).join(', ')
  };

  return {
    location,
    current,
    hourly,
    daily,
    condition: mapConditionFromId(current.weather?.id || 800)
  };
}

async function getWeather({ city, coords, apiKey, units = 'metric' } = {}) {
  // Prefer live OWM if apiKey present
  if (apiKey && (city || coords)) {
    try {
      let place = null;
      let lat, lon;
      if (coords?.lat && coords?.lon) {
        lat = coords.lat; lon = coords.lon;
      } else if (city) {
        place = await findCoordsByCity(city, apiKey);
        lat = place.lat; lon = place.lon;
      } else {
        throw new Error('No location provided');
      }
      const onecall = await fetchJson(OWM.onecall(lat, lon, units, apiKey));
      return formatWeather(onecall, place, units);
    } catch (err) {
      console.warn('Live weather fetch failed, falling back to mock:', err?.message);
      return getMockWeather(units);
    }
  }

  // Fallback to mock
  return getMockWeather(units);
}

async function getMockWeather(units = 'metric') {
  try {
    const data = await fetchJson('assets/mock/sample-weather.json');
    return formatWeather(data, { name: data.city || 'Demo City' }, units);
  } catch (e) {
    // Last-resort static sample if fetch fails due to file serving constraints
    const now = Date.now();
    const sample = {
      timezone_offset: 0,
      current: { dt: Math.floor(now / 1000), temp: 22, feels_like: 22, humidity: 58, wind_speed: 12, wind_deg: 210, weather: [{ id: 800, description: 'Clear Sky', main: 'Clear' }] },
      hourly: Array.from({ length: 12 }, (_, i) => ({ dt: Math.floor((now / 1000) + i * 3600), temp: 22 + Math.sin(i / 2) * 3, weather: [{ id: 800 }] })),
      daily: Array.from({ length: 7 }, (_, i) => ({ dt: Math.floor((now / 1000) + i * 86400), temp: { min: 16 + Math.sin(i) * 2, max: 24 + Math.cos(i) * 2 }, weather: [{ id: i % 3 ? 801 : 500, description: 'Varied' }] }))
    };
    return formatWeather(sample, { name: 'Local Demo' }, units);
  }
}

export { getWeather, mapConditionFromId };
