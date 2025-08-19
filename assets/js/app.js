import { getWeather, mapConditionFromId } from './weather.js';
import { FXEngine, CONDITIONS } from './animations.js';

const els = {
  cityInput: document.getElementById('city-input'),
  searchForm: document.getElementById('search-form'),
  geoBtn: document.getElementById('geo-btn'),
  unitsToggle: document.getElementById('units-toggle'),
  apiKeyInput: document.getElementById('api-key'),
  temp: document.getElementById('current-temp'),
  desc: document.getElementById('current-desc'),
  meta: document.getElementById('current-meta'),
  icon: document.getElementById('current-icon'),
  place: document.getElementById('place'),
  time: document.getElementById('time'),
  hourlyCanvas: document.getElementById('hourly-chart'),
  forecastList: document.getElementById('forecast-list'),
  fxCanvas: document.getElementById('fx-canvas')
};

const fx = new FXEngine(els.fxCanvas);

const state = {
  units: localStorage.getItem('units') || 'metric',
  apiKey: localStorage.getItem('owm_api_key') || '',
  lastCity: localStorage.getItem('last_city') || 'San Francisco',
  lastData: null
};

// Initialize UI state
els.apiKeyInput.value = state.apiKey;
els.unitsToggle.checked = state.units === 'imperial';
els.cityInput.value = state.lastCity;

function toUnitSymbol(units) { return units === 'imperial' ? '°F' : '°C'; }
function windUnit(units) { return units === 'imperial' ? 'mph' : 'm/s'; }

function conditionToFx(cond) {
  switch (cond) {
    case 'thunder': return CONDITIONS.THUNDER;
    case 'drizzle': return CONDITIONS.DRIZZLE;
    case 'rain': return CONDITIONS.RAIN;
    case 'snow': return CONDITIONS.SNOW;
    case 'clouds': return CONDITIONS.CLOUDS;
    case 'fog': return CONDITIONS.FOG;
    case 'clear': return CONDITIONS.CLEAR;
    default: return CONDITIONS.NONE;
  }
}

function iconFor(conditionId) {
  // Minimal icon mapping using emoji for now to avoid assets
  if (conditionId >= 200 && conditionId < 300) return '⛈️';
  if (conditionId >= 300 && conditionId < 400) return '🌦️';
  if (conditionId >= 500 && conditionId < 600) return '🌧️';
  if (conditionId >= 600 && conditionId < 700) return '❄️';
  if (conditionId === 800) return '☀️';
  if (conditionId > 800) return '☁️';
  return '🌡️';
}

function dayName(d) { return d.toLocaleDateString(undefined, { weekday: 'short' }); }
function timeLabel(d) { return d.toLocaleTimeString(undefined, { hour: 'numeric' }); }
function fullTime(d) { return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }); }

function degToCompass(deg) {
  if (typeof deg !== 'number' || isNaN(deg)) return '';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

function arrowForDeg(deg) {
  if (typeof deg !== 'number' || isNaN(deg)) return '';
  const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
  return arrows[Math.round(((deg % 360) / 45)) % 8];
}

function renderCurrent(data) {
  const { current, location } = data;
  els.temp.textContent = `${current.temp}${toUnitSymbol(current.units)}`;
  els.desc.textContent = current.weather?.description || '—';
  const windDir = degToCompass(current.wind_deg);
  const windArrow = arrowForDeg(current.wind_deg);
  const uviPart = (typeof current.uvi === 'number') ? ` • UV ${Math.round(current.uvi)}` : '';
  els.meta.textContent = `Feels ${current.feels_like}${toUnitSymbol(current.units)} • Wind ${current.wind_speed} ${windUnit(current.units)} ${windDir} ${windArrow} • Humidity ${current.humidity}%${uviPart}`;
  els.icon.textContent = iconFor(current.weather?.id || 800);
  els.place.textContent = [location.name, location.region].filter(Boolean).join(' · ');
  els.time.textContent = fullTime(current.dt);
}

function drawHourlyChart(canvas, hourly, units) {
  const ctx = canvas.getContext('2d');
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const widthCSS = canvas.clientWidth || 900;
  const heightCSS = 200;
  canvas.width = Math.floor(widthCSS * ratio);
  canvas.height = Math.floor(heightCSS * ratio);
  canvas.style.width = widthCSS + 'px';
  canvas.style.height = heightCSS + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.clearRect(0, 0, widthCSS, heightCSS);
  const padding = { l: 40, r: 12, t: 12, b: 24 };
  const w = widthCSS - padding.l - padding.r;
  const h = heightCSS - padding.t - padding.b;
  const temps = hourly.map(h => h.temp);
  const min = Math.min(...temps) - 1;
  const max = Math.max(...temps) + 1;
  const x = (i) => padding.l + (i * (w / (hourly.length - 1)));
  const y = (t) => padding.t + (h - (h * (t - min) / (max - min || 1)));

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < hourly.length; i++) {
    const gx = x(i);
    ctx.moveTo(gx, padding.t);
    ctx.lineTo(gx, padding.t + h);
  }
  ctx.stroke();

  // line
  const grad = ctx.createLinearGradient(padding.l, 0, padding.l + w, 0);
  grad.addColorStop(0, '#60a5fa');
  grad.addColorStop(1, '#a78bfa');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  hourly.forEach((p, i) => {
    const px = x(i), py = y(p.temp);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Precipitation probability overlay (bars at bottom) if available
  const hasPop = hourly.some(p => typeof p.pop === 'number');
  if (hasPop) {
    const baseY = padding.t + h;
    const barSpan = (w / (hourly.length - 1));
    const barW = Math.max(4, Math.min(14, barSpan * 0.5));
    hourly.forEach((p, i) => {
      const prob = Math.max(0, Math.min(1, p.pop || 0));
      const bh = Math.round(prob * (h * 0.5));
      const px = x(i) - barW / 2;
      ctx.fillStyle = 'rgba(96,165,250,0.28)';
      ctx.fillRect(px, baseY - bh, barW, bh);
      if (prob >= 0.45) {
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText(`${Math.round(prob * 100)}%`, x(i), baseY - bh - 4);
      }
    });
  }

  // dots + labels
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  hourly.forEach((p, i) => {
    const px = x(i), py = y(p.temp);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(229,231,235,0.8)';
    ctx.fillText(`${p.temp}${toUnitSymbol(units)}`, px, py - 8);
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.fillText(timeLabel(p.dt), px, padding.t + h + 16);
  });
}

function renderForecast(listEl, daily, units) {
  listEl.innerHTML = '';
  daily.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'forecast-item';
    const icon = iconFor(d.weather?.id || 800);
    item.innerHTML = `
      <div class="day">${dayName(d.dt)}</div>
      <div class="icon" aria-hidden="true">${icon}</div>
      <div class="temps">${d.temp.max}${toUnitSymbol(units)} / <span style="color:#94a3b8">${d.temp.min}${toUnitSymbol(units)}</span></div>
    `;
    item.style.animationDelay = `${i * 40}ms`;
    listEl.appendChild(item);
  });
}

function updateFXForConditionId(id) {
  const c = conditionToFx(mapConditionFromId(id));
  fx.setCondition(c);
}

async function loadWeather({ city, coords } = {}) {
  const units = state.units;
  const apiKey = state.apiKey?.trim();
  const data = await getWeather({ city, coords, apiKey, units });
  state.lastData = data;
  try {
    renderCurrent(data);
    drawHourlyChart(els.hourlyCanvas, data.hourly, units);
    renderForecast(els.forecastList, data.daily, units);
    updateFXForConditionId(data.current.weather?.id || 800);
  } catch (e) {
    console.error('Render error', e);
  }
}

// Events
els.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = (els.cityInput.value || '').trim();
  if (!q) return;
  state.lastCity = q;
  localStorage.setItem('last_city', q);
  loadWeather({ city: q });
});

els.geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation not supported');
    return;
  }
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    loadWeather({ coords: { lat, lon } });
  }, () => {
    // fallback to city
    loadWeather({ city: state.lastCity || 'San Francisco' });
  });
});

els.unitsToggle.addEventListener('change', () => {
  state.units = els.unitsToggle.checked ? 'imperial' : 'metric';
  localStorage.setItem('units', state.units);
  if (state.lastData) {
    // re-fetch to convert server-side if API available; else derive client-side
    const city = state.lastCity;
    const apiKey = state.apiKey?.trim();
    if (apiKey) {
      loadWeather({ city });
    } else {
      // client-side conversion for mock
      convertUnitsInPlace(state.lastData, state.units);
      renderCurrent(state.lastData);
      drawHourlyChart(els.hourlyCanvas, state.lastData.hourly, state.units);
      renderForecast(els.forecastList, state.lastData.daily, state.units);
    }
  }
});

els.apiKeyInput.addEventListener('input', () => {
  state.apiKey = els.apiKeyInput.value.trim();
  localStorage.setItem('owm_api_key', state.apiKey);
});

function convertUnitsInPlace(data, units) {
  const toF = c => Math.round((c * 9) / 5 + 32);
  const toC = f => Math.round(((f - 32) * 5) / 9);
  const targetIsF = units === 'imperial';
  const conv = targetIsF ? toF : toC;
  const windConv = targetIsF ? (ms => Math.round(ms * 2.23694)) : (mph => Math.round(mph / 2.23694));
  data.current.temp = conv(data.current.temp);
  data.current.feels_like = conv(data.current.feels_like);
  data.current.wind_speed = windConv(data.current.wind_speed);
  data.current.units = units;
  data.hourly = data.hourly.map(h => ({ ...h, temp: conv(h.temp) }));
  data.daily = data.daily.map(d => ({ ...d, temp: { min: conv(d.temp.min), max: conv(d.temp.max) } }));
}

// Initial load sequence
(function init() {
  // attempt geolocation first; fallback to last city
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      loadWeather({ coords: { lat, lon } });
    }, () => loadWeather({ city: state.lastCity }));
  } else {
    loadWeather({ city: state.lastCity });
  }
})();

// Redraw chart responsively on resize if data available
window.addEventListener('resize', () => {
  if (state.lastData) {
    drawHourlyChart(els.hourlyCanvas, state.lastData.hourly, state.units);
  }
});
