import { WEATHERS, type Weather } from "../engine/weather";

interface Drop {
  x: number;
  y: number;
  len: number;
  v: number;
  /** Phase for the wobble of blown dust and leaves. */
  p: number;
}

/**
 * The sky drawn over the whole match stage, including the illustrated cutaways: falling rain, dust and
 * leaves blown sideways on a windy day, a dusty harmattan haze, a sunny glow, or hot shimmering air. It only draws: the canvas ignores the
 * mouse and the weather never changes the match. Clear weather adds no canvas work at all.
 */
export class WeatherLayer {
  readonly canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d");
  private drops: Drop[] = [];
  private raf = 0;
  private last = 0;
  private t = 0;
  private w = 0;
  private h = 0;
  private disposed = false;

  constructor(private weather: Weather) {
    this.canvas.className = "weather-fx";
    this.canvas.setAttribute("aria-hidden", "true");
    const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (WEATHERS[weather.id].fx === "none" || !this.ctx || calm) {
      this.canvas.hidden = true;
      return;
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return false;
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Scale the number of particles with the area so a wide stage is as busy as a narrow one.
      const count = Math.round((WEATHERS[this.weather.id].drops * w * h) / (800 * 372));
      this.drops = Array.from({ length: count }, () => this.spawn(true));
    }
    return true;
  }

  private spawn(anywhere: boolean): Drop {
    const spec = WEATHERS[this.weather.id];
    const near = Math.random();
    const blown = spec.fx === "gust";
    const haze = spec.fx === "haze";
    const dir = this.weather.wind < 0 ? -1 : 1;
    return {
      x: blown && !anywhere ? (dir > 0 ? -30 : this.w + 30) : Math.random() * (this.w + 120) - 60,
      y: blown || haze ? Math.random() * this.h : anywhere ? Math.random() * this.h : -20 - Math.random() * 40,
      len: blown ? 10 + near * 22 : haze ? 1 + near * 2 : 7 + near * 11,
      v: spec.speed * (0.7 + near * 0.5),
      p: Math.random() * 6.28,
    };
  }

  private frame(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    if (!this.fit()) return;
    const fx = WEATHERS[this.weather.id].fx;
    this.ctx!.clearRect(0, 0, this.w, this.h);
    if (fx === "rain") this.rain(dt);
    else if (fx === "gust") this.gust(dt);
    else if (fx === "haze") this.haze(dt);
    else if (fx === "sun") this.sun();
    else this.heat(dt);
  }

  private rain(dt: number) {
    const ctx = this.ctx!;
    const spec = WEATHERS[this.weather.id];
    const drift = this.weather.wind * 0.45;
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(190, 215, 235, ${spec.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.y += d.v * dt;
      d.x += d.v * drift * dt;
      if (d.y > this.h + 20 || d.x < -80 || d.x > this.w + 80) {
        this.drops[i] = this.spawn(false);
        continue;
      }
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - drift * d.len, d.y - d.len);
    }
    ctx.stroke();
  }

  /** Dust streaks racing sideways, with a few leaves tumbling along. */
  private gust(dt: number) {
    const ctx = this.ctx!;
    const spec = WEATHERS[this.weather.id];
    const dir = this.weather.wind < 0 ? -1 : 1;
    const pace = 0.7 + Math.abs(this.weather.wind) * 0.6;
    ctx.lineCap = "round";
    ctx.lineWidth = 1;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      const leaf = i % 9 === 0;
      d.x += dir * d.v * pace * dt;
      d.y += Math.sin(this.t * (leaf ? 4 : 2) + d.p) * (leaf ? 40 : 8) * dt;
      if (d.x < -60 || d.x > this.w + 60) {
        this.drops[i] = this.spawn(false);
        continue;
      }
      if (leaf) {
        ctx.fillStyle = `rgba(150, 170, 90, ${spec.alpha + 0.2})`;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(this.t * 3 + d.p);
        ctx.fillRect(-3, -1.5, 6, 3);
        ctx.restore();
      } else {
        ctx.strokeStyle = `rgba(215, 200, 170, ${spec.alpha * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - dir * d.len * pace, d.y);
        ctx.stroke();
      }
    }
  }

  /** A warm, dusty wash over everything, with fine specks drifting slowly in the wind. */
  private haze(dt: number) {
    const ctx = this.ctx!;
    const spec = WEATHERS[this.weather.id];
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, "rgba(205, 170, 120, 0.1)");
    g.addColorStop(1, "rgba(205, 170, 120, 0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = `rgba(230, 205, 160, ${spec.alpha})`;
    const dir = this.weather.wind < 0 ? -1 : 1;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.x += dir * d.v * (0.5 + Math.abs(this.weather.wind)) * dt;
      d.y += Math.sin(this.t * 0.8 + d.p) * 6 * dt;
      if (d.x < -20 || d.x > this.w + 20) {
        this.drops[i] = { ...this.spawn(true), x: dir > 0 ? -10 : this.w + 10 };
        continue;
      }
      ctx.fillRect(d.x, d.y, d.len, d.len);
    }
  }

  /** A warm glow from the top corner. */
  private sun() {
    const ctx = this.ctx!;
    const a = WEATHERS[this.weather.id].alpha;
    const x = this.weather.wind < 0 ? this.w * 0.88 : this.w * 0.12;
    const glow = ctx.createRadialGradient(x, -10, 0, x, -10, this.h * 1.1);
    glow.addColorStop(0, `rgba(255, 235, 170, ${a})`);
    glow.addColorStop(1, "rgba(255, 235, 170, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  /** An orange warmth over everything, with faint heat waves rising from the bottom. */
  private heat(dt: number) {
    const ctx = this.ctx!;
    const a = WEATHERS[this.weather.id].alpha;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, `rgba(255, 190, 90, ${a * 0.35})`);
    g.addColorStop(1, `rgba(255, 140, 50, ${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 235, 200, 0.12)";
    for (const d of this.drops) {
      d.y -= d.v * dt;
      if (d.y < this.h * 0.5) d.y = this.h + Math.random() * 20;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const yy = d.y - k * 8;
        const xx = d.x + Math.sin(this.t * 2 + yy * 0.05 + d.p) * 4;
        if (k === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }
}
