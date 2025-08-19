// Weather data module (OpenWeatherMap only)
// Requires a valid OpenWeatherMap API key; no local fallback.
// Falls back from One Call v3.0 to Current + 5-day (3h) if needed.

const OWM = {
  geo: (q, limit = 1, key) => `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=${limit}&appid=${key}`,
  onecall: (lat, lon, units, key) => `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`,
  current: (lat, lon, units, key) => `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`,
  forecast: (lat, lon, units, key) => `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`
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

function formatWeatherFromOneCall(onecall, place, units) {
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

function formatWeatherFromCurrentForecast(current, forecast, place, units) {
  const tzOffsetSec = (forecast?.city?.timezone ?? current?.timezone ?? 0);
  const tzOffset = tzOffsetSec * 1000;
  const now = new Date((current.dt * 1000) + tzOffset);

  const cur = {
    dt: now,
    temp: Math.round(current.main?.temp),
    feels_like: Math.round(current.main?.feels_like ?? current.main?.temp),
    humidity: current.main?.humidity,
    wind_speed: Math.round(current.wind?.speed ?? 0),
    wind_deg: current.wind?.deg,
    uvi: undefined,
    weather: current.weather?.[0] || { id: 800, description: 'Clear', main: 'Clear' },
    units
  };

  const list = Array.isArray(forecast?.list) ? forecast.list : [];
  // Build next 12 hourly samples via linear interpolation from 3h steps
  const nowMs = Date.now();
  const targets = Array.from({ length: 12 }, (_, i) => new Date(nowMs + (i + 1) * 3600_000));
  const hourly = targets.map((t) => {
    // find surrounding points
    const tms = Math.floor((t.getTime() - tzOffset) / 1000);
    let prev = null, next = null;
    for (let i = 0; i < list.length; i++) {
      const itm = list[i];
      if (itm.dt <= tms) prev = itm;
      if (itm.dt > tms) { next = itm; break; }
    }
    if (!prev) prev = list[0];
    if (!next) next = list[list.length - 1] || prev;
    const t0 = prev?.dt ?? tms, t1 = next?.dt ?? tms;
    const temp0 = prev?.main?.temp ?? cur.temp;
    const temp1 = next?.main?.temp ?? cur.temp;
    const pop0 = typeof prev?.pop === 'number' ? prev.pop : 0;
    const pop1 = typeof next?.pop === 'number' ? next.pop : pop0;
    const r = (tms - t0) / Math.max(1, (t1 - t0));
    const temp = Math.round(temp0 + (temp1 - temp0) * Math.max(0, Math.min(1, r)));
    const pop = Math.max(0, Math.min(1, pop0 + (pop1 - pop0) * Math.max(0, Math.min(1, r))));
    const weather = (r < 0.5 ? prev?.weather?.[0] : next?.weather?.[0]) || cur.weather;
    return { dt: t, temp, pop, weather };
  });

  // Build up to 5 days of daily min/max from forecast list
  const byDay = new Map();
  list.forEach((itm) => {
    const d = new Date((itm.dt * 1000) + tzOffset);
    const key = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
    const cur = byDay.get(key) || { temps: [], sample: itm };
    cur.temps.push(Math.round(itm.main?.temp));
    if (Math.abs(d.getHours() - 12) < Math.abs(new Date((cur.sample.dt * 1000) + tzOffset).getHours() - 12)) {
      cur.sample = itm;
    }
    byDay.set(key, cur);
  });
  const daily = Array.from(byDay.entries()).slice(0, 7).map(([_, v]) => {
    const min = Math.min(...v.temps);
    const max = Math.max(...v.temps);
    const dt = new Date((v.sample.dt * 1000) + tzOffset);
    const weather = v.sample.weather?.[0];
    return { dt, temp: { min, max }, weather };
  });

  const location = {
    name: place?.name ?? forecast?.city?.name ?? '—',
    region: [place?.state, place?.country].filter(Boolean).join(', ')
  };

  return {
    location,
    current: cur,
    hourly,
    daily,
    condition: mapConditionFromId(cur.weather?.id || 800)
  };
}

async function getWeather({ city, coords, apiKey, units = 'metric' } = {}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('OpenWeatherMap API key is required');
  }

  if (!city && !(coords?.lat && coords?.lon)) {
    throw new Error('No location provided');
  }

  let place = null;
  let lat, lon;
  if (coords?.lat && coords?.lon) {
    lat = coords.lat; lon = coords.lon;
  } else if (city) {
    place = await findCoordsByCity(city, apiKey);
    lat = place.lat; lon = place.lon;
  }

  // Try One Call v3.0 first
  try {
    const onecall = await fetchJson(OWM.onecall(lat, lon, units, apiKey));
    return formatWeatherFromOneCall(onecall, place, units);
  } catch (e) {
    // Fallback to Current + 5-day (3h)
    try {
      const [cur, fc] = await Promise.all([
        fetchJson(OWM.current(lat, lon, units, apiKey)),
        fetchJson(OWM.forecast(lat, lon, units, apiKey))
      ]);
      return formatWeatherFromCurrentForecast(cur, fc, place, units);
    } catch (e2) {
      const msg = (e?.message || 'One Call failed') + ' | Fallback failed: ' + (e2?.message || 'Unknown error');
      const err = new Error(msg);
      err.cause = { primary: e, fallback: e2 };
      throw err;
    }
  }
}

export { getWeather, mapConditionFromId };
