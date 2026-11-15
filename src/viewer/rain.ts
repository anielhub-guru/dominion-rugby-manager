import { WEATHERS, type Weather } from "../engine/weather";

interface Drop {
  x: number;
  y: number;
  len: number;
  v: number;
}

/**
 * Falling rain drawn over the whole match stage, including the illustrated cutaways. It only draws:
 * the canvas ignores the mouse and the weather never changes the match. Dry weather adds no canvas work at all.
 */
export class RainLayer {
  readonly canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d");
  private drops: Drop[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private disposed = false;

  constructor(private weather: Weather) {
    this.canvas.className = "rain";
    this.canvas.setAttribute("aria-hidden", "true");
    const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (weather.id === "clear" || !this.ctx || calm) {
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
      // Scale the number of drops with the area so a wide stage is as wet as a narrow one.
      const count = Math.round((WEATHERS[this.weather.id].drops * w * h) / (800 * 372));
      this.drops = Array.from({ length: count }, () => this.spawn(true));
    }
    return true;
  }

  private spawn(anywhere: boolean): Drop {
    const spec = WEATHERS[this.weather.id];
    const near = Math.random();
    return {
      x: Math.random() * (this.w + 120) - 60,
      y: anywhere ? Math.random() * this.h : -20 - Math.random() * 40,
      len: 7 + near * 11,
      v: spec.speed * (0.7 + near * 0.5),
    };
  }

  private frame(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.fit()) return;
    const ctx = this.ctx!;
    const spec = WEATHERS[this.weather.id];
    const drift = this.weather.wind * 0.45;
    ctx.clearRect(0, 0, this.w, this.h);
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

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }
}
