// Simple animation engine for weather effects rendered on a fullscreen canvas
// Supported: rain, snow, thunder flashes, clear ambient shimmer, clouds drift

const CONDITIONS = {
  CLEAR: 'clear',
  RAIN: 'rain',
  DRIZZLE: 'drizzle',
  THUNDER: 'thunder',
  SNOW: 'snow',
  CLOUDS: 'clouds',
  FOG: 'fog',
  WIND: 'wind',
  NONE: 'none'
};

class FXEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.flashes = [];
    this.clouds = [];
    this.fog = [];
    this.resizeObserver = null;
    this.running = false;
    this.condition = CONDITIONS.NONE;
    this.lastTime = 0;
    this.wind = 0; // -1..1
    this._loop = this._loop.bind(this);
    this.init();
  }

  init() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const size = () => {
      const { innerWidth: w, innerHeight: h } = window;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener('resize', size);
  }

  setCondition(kind) {
    this.condition = kind || CONDITIONS.NONE;
    this.particles = [];
    this.clouds = [];
    this.flashes = [];
    this.fog = [];
    this.wind = 0;

    switch (this.condition) {
      case CONDITIONS.RAIN:
      case CONDITIONS.DRIZZLE:
        this.spawnRain(this.condition === CONDITIONS.DRIZZLE ? 200 : 400);
        this.wind = 0.2;
        break;
      case CONDITIONS.SNOW:
        this.spawnSnow(220);
        this.wind = 0.1;
        break;
      case CONDITIONS.THUNDER:
        this.spawnRain(450);
        this.wind = 0.25;
        break;
      case CONDITIONS.CLOUDS:
        this.spawnClouds(8);
        this.wind = 0.08;
        break;
      case CONDITIONS.FOG:
        this.spawnFog(7);
        this.wind = 0.05;
        break;
      case CONDITIONS.CLEAR:
        // subtle ambience only
        break;
      default:
        // nothing
        break;
    }

    if (!this.running) {
      this.running = true;
      requestAnimationFrame(this._loop);
    }
  }

  spawnRain(count) {
    const { innerWidth: w, innerHeight: h } = window;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (w + 200) - 100,
        y: Math.random() * (h + 200) - 100,
        l: 8 + Math.random() * 16,
        s: 1 + Math.random() * 1.5,
        o: 0.35 + Math.random() * 0.4,
        a: Math.PI * 1.15 // ~ 207° diagonal
      });
    }
  }

  spawnSnow(count) {
    const { innerWidth: w, innerHeight: h } = window;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.8 + Math.random() * 2.2,
        s: 0.3 + Math.random() * 0.6,
        drift: (Math.random() - 0.5) * 0.5,
        o: 0.6 + Math.random() * 0.35
      });
    }
  }

  spawnClouds(count) {
    const { innerWidth: w, innerHeight: h } = window;
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.4),
        w: 120 + Math.random() * 220,
        h: 50 + Math.random() * 80,
        s: 0.08 + Math.random() * 0.1,
        o: 0.05 + Math.random() * 0.08
      });
    }
  }

  spawnFog(count) {
    const { innerWidth: w, innerHeight: h } = window;
    for (let i = 0; i < count; i++) {
      const bw = w * (0.6 + Math.random() * 0.8);
      const bh = 40 + Math.random() * 120;
      this.fog.push({
        x: Math.random() * (w + bw) - bw,
        y: Math.random() * (h - bh),
        w: bw,
        h: bh,
        s: 0.02 + Math.random() * 0.06,
        o: 0.06 + Math.random() * 0.12
      });
    }
  }

  flash() {
    this.flashes.push({ t: 0, life: 400 + Math.random() * 400 });
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = this.lastTime ? Math.min(50, ts - this.lastTime) : 16;
    this.lastTime = ts;
    this.draw(dt);

    // random thunder flash
    if (this.condition === CONDITIONS.THUNDER && Math.random() < 0.005) {
      this.flash();
    }

    requestAnimationFrame(this._loop);
  }

  draw(dt) {
    const { ctx } = this;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // Ambient shimmer for clear
    if (this.condition === CONDITIONS.CLEAR) {
      const grad = ctx.createRadialGradient(w * 0.75, h * 0.05, 20, w * 0.75, h * 0.05, w * 0.5);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.05, w * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clouds
    if (this.clouds.length) {
      for (const c of this.clouds) {
        c.x += c.s * dt * (0.06 + this.wind);
        if (c.x - c.w > w + 50) c.x = -c.w - 50;
        this.drawCloud(c);
      }
    }

    // Fog layers (ambience)
    if (this.fog.length && this.condition === CONDITIONS.FOG) {
      for (const f of this.fog) {
        f.x += f.s * dt * (0.05 + this.wind);
        if (f.x > w + 60) {
          f.x = -f.w - 60;
          f.y = Math.random() * (h - f.h);
        }
        this.drawFogBand(f);
      }
    }

    // Particles (rain or snow)
    if (this.particles.length) {
      if (this.condition === CONDITIONS.RAIN || this.condition === CONDITIONS.DRIZZLE || this.condition === CONDITIONS.THUNDER) {
        ctx.strokeStyle = 'rgba(200,220,255,0.5)';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        for (const p of this.particles) {
          p.x += Math.cos(p.a) * p.s * 8 * (1 + this.wind);
          p.y += Math.sin(p.a) * p.s * 8;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * (w + 200) - 100; }
          ctx.globalAlpha = p.o;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(p.a) * p.l, p.y - Math.sin(p.a) * p.l);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (this.condition === CONDITIONS.SNOW) {
        for (const p of this.particles) {
          p.x += (p.drift + this.wind * 0.6) * dt * 0.06;
          p.y += p.s * dt * 0.06 * 1.6;
          if (p.y > h + 5) { p.y = -5; p.x = Math.random() * w; }
          if (p.x < -5) p.x = w + 5; else if (p.x > w + 5) p.x = -5;
          this.drawSnowflake(p);
        }
      }
    }

    // Thunder flashes
    if (this.flashes.length) {
      this.flashes = this.flashes.filter(f => (f.t += dt) < f.life);
      for (const f of this.flashes) {
        const alpha = 0.7 * (1 - f.t / f.life);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(0, 0, w, h);
      }
    }
  }

  drawCloud(c) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = c.o;
    ctx.fillStyle = '#dde7ff';
    const x = c.x, y = c.y, w = c.w, h = c.h;
    // Simple blobby cloud using overlapping circles
    for (let i = 0; i < 5; i++) {
      const cx = x + (i - 2) * (w / 6) + Math.sin((x + i * 20) * 0.01) * 4;
      const cy = y + (i % 2) * (h / 6);
      this.roundRect(cx, cy, w / 3, h / 1.8, h / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFogBand(f) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = f.o;
    const grad = ctx.createLinearGradient(f.x, f.y, f.x, f.y + f.h);
    grad.addColorStop(0, 'rgba(230,236,255,0)');
    grad.addColorStop(0.5, 'rgba(230,236,255,0.9)');
    grad.addColorStop(1, 'rgba(230,236,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.restore();
  }

  roundRect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  drawSnowflake(p) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = p.o;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export { FXEngine, CONDITIONS };
