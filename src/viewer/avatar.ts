import type { Gender, Look, Player } from "../engine/types";
import { BUILDS, lookOf } from "../league/look";
import a0 from "../assets/avatars/a0.webp";
import a1 from "../assets/avatars/a1.webp";
import a2 from "../assets/avatars/a2.webp";
import a3 from "../assets/avatars/a3.webp";
import a4 from "../assets/avatars/a4.webp";
import a5 from "../assets/avatars/a5.webp";
import a6 from "../assets/avatars/a6.webp";
import a7 from "../assets/avatars/a7.webp";
import a8 from "../assets/avatars/a8.webp";
import a9 from "../assets/avatars/a9.webp";
import a10 from "../assets/avatars/a10.webp";
import b0 from "../assets/avatars/b0.webp";
import b1 from "../assets/avatars/b1.webp";
import b2 from "../assets/avatars/b2.webp";
import b3 from "../assets/avatars/b3.webp";
import b4 from "../assets/avatars/b4.webp";
import b5 from "../assets/avatars/b5.webp";
import b6 from "../assets/avatars/b6.webp";
import b7 from "../assets/avatars/b7.webp";
import b8 from "../assets/avatars/b8.webp";
import b9 from "../assets/avatars/b9.webp";
import b10 from "../assets/avatars/b10.webp";

/** Women's player portraits: white outline art, eleven hairstyles in two base faces. */
const FACE_ART = [[a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10], [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10]];

// Face landmarks (eyes, nose, lips, jaw), normalised per portrait crop, for each base face.
const FACE_Y = [
  [[.33, .41, .46, .52], [.43, .49, .54, .59], [.30, .39, .45, .51], [.31, .39, .45, .51], [.25, .34, .41, .48], [.28, .36, .43, .50], [.33, .43, .50, .59], [.34, .43, .50, .59], [.34, .43, .50, .59], [.34, .43, .50, .59], [.34, .43, .50, .59]],
  [[.32, .40, .46, .53], [.37, .43, .49, .56], [.31, .39, .45, .52], [.31, .38, .45, .51], [.28, .36, .43, .51], [.29, .37, .44, .51], [.33, .43, .50, .59], [.34, .43, .50, .59], [.34, .43, .50, .59], [.34, .43, .50, .59], [.34, .43, .50, .59]],
];

/** Draws a padded, wraparound rugby visor with the nose left exposed. */
function goggles(ctx: CanvasRenderingContext2D, width: number, height: number, look: Look): void {
  const afroFaceTwo = look.face === 1 && look.portrait === 6;
  const eyeY = FACE_Y[look.face][look.portrait][0] * height + (afroFaceTwo ? height * 0.006 : 0);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (afroFaceTwo) ctx.translate(-width * 0.012, 0);

  // Broad retention strap, tucked beneath the visor at both temples.
  ctx.strokeStyle = "#303532";
  ctx.lineWidth = Math.max(4, width * 0.024);
  ctx.beginPath();
  ctx.moveTo(width * 0.29, eyeY - height * 0.008);
  ctx.lineTo(width * 0.215, eyeY - height * 0.025);
  ctx.moveTo(width * 0.71, eyeY - height * 0.008);
  ctx.lineTo(width * 0.785, eyeY - height * 0.025);
  ctx.stroke();

  // One continuous curved visor and padded perimeter—not two spectacle lenses.
  ctx.fillStyle = "rgba(190, 204, 198, 0.22)";
  ctx.strokeStyle = "#303532";
  ctx.lineWidth = Math.max(3, width * 0.013);
  ctx.beginPath();
  ctx.moveTo(width * 0.29, eyeY - height * 0.032);
  ctx.bezierCurveTo(width * 0.36, eyeY - height * 0.072, width * 0.64, eyeY - height * 0.072, width * 0.71, eyeY - height * 0.032);
  ctx.quadraticCurveTo(width * 0.735, eyeY, width * 0.705, eyeY + height * 0.046);
  ctx.bezierCurveTo(width * 0.65, eyeY + height * 0.066, width * 0.59, eyeY + height * 0.058, width * 0.545, eyeY + height * 0.035);
  ctx.quadraticCurveTo(width * 0.5, eyeY + height * 0.003, width * 0.455, eyeY + height * 0.035);
  ctx.bezierCurveTo(width * 0.41, eyeY + height * 0.058, width * 0.35, eyeY + height * 0.066, width * 0.295, eyeY + height * 0.046);
  ctx.quadraticCurveTo(width * 0.265, eyeY, width * 0.29, eyeY - height * 0.032);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // A shallow inner rim reinforces the padded-mask construction.
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = Math.max(1.2, width * 0.0045);
  ctx.beginPath();
  ctx.moveTo(width * 0.315, eyeY - height * 0.022);
  ctx.bezierCurveTo(width * 0.39, eyeY - height * 0.05, width * 0.61, eyeY - height * 0.05, width * 0.685, eyeY - height * 0.022);
  ctx.stroke();
  ctx.restore();
}

const falloff = (value: number) => {
  const t = Math.max(0, 1 - Math.abs(value));
  return t * t * (3 - 2 * t);
};
const sign = (v: number) => (v === 1 ? -1 : v === 2 ? 1 : 0);

/** Warps the face features (eyes, nose, lips, jaw) of a portrait. */
function deform(pixels: Uint8ClampedArray, width: number, height: number, look: Look): Uint8ClampedArray {
  const [eyes, nose, lips, jaw] = FACE_Y[look.face][look.portrait];
  const out = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1), v = y / (height - 1), cx = u - 0.5;
      const dx = -cx * (0.29 * sign(look.nose) * falloff(cx / 0.084) * falloff((v - nose) / 0.059) + 0.32 * sign(look.jaw) * falloff(cx / 0.3) * falloff((v - jaw) / 0.093));
      const eyeZone = falloff((Math.abs(cx) - 0.067) / 0.062);
      const dy = -(v - eyes) * 0.38 * sign(look.eyes) * eyeZone * falloff((v - eyes) / 0.054) - (v - lips) * 0.45 * sign(look.lips) * falloff(cx / 0.105) * falloff((v - lips) / 0.05);
      const sx = Math.max(0, Math.min(width - 1, (u + dx) * (width - 1)));
      const sy = Math.max(0, Math.min(height - 1, (v + dy) * (height - 1)));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
      const a = sx - x0, b = sy - y0;
      for (let k = 0; k < 4; k++) {
        const first = pixels[(y0 * width + x0) * 4 + k] * (1 - a) + pixels[(y0 * width + x1) * 4 + k] * a;
        const second = pixels[(y1 * width + x0) * 4 + k] * (1 - a) + pixels[(y1 * width + x1) * 4 + k] * a;
        out[(y * width + x) * 4 + k] = first * (1 - b) + second * b;
      }
    }
  }
  return out;
}

const images = new Map<string, Promise<HTMLImageElement>>();
const load = (uri: string) => {
  if (!images.has(uri)) {
    const img = new Image();
    img.src = uri;
    images.set(uri, img.decode().then(() => img));
  }
  return images.get(uri)!;
};

async function paint(canvas: HTMLCanvasElement, look: Look): Promise<void> {
  const image = await load(FACE_ART[look.face][look.portrait]);
  const w = (canvas.width = image.naturalWidth), h = (canvas.height = image.naturalHeight);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  if (look.goggles) goggles(ctx, w, h, look);
  if (look.eyes || look.nose || look.lips || look.jaw) {
    const data = ctx.getImageData(0, 0, w, h);
    data.data.set(deform(data.data, w, h, look));
    ctx.putImageData(data, 0, 0);
  }
}

/** A canvas showing a player's avatar. It fills in once the artwork has decoded. */
export function avatarCanvas(look: Look, label: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", label);
  canvas.className = "avatar-art";
  canvas.style.transform = `scaleX(${BUILDS[look.build][1]})`;
  void paint(canvas, look).catch(() => canvas.remove());
  return canvas;
}

/** A small framed avatar for a player, or null when there is no artwork (men's league) or the player has left. */
export function avatarBadge(p: Player | undefined, gender: Gender, size: "sm" | "md" | "lg" = "md"): HTMLElement | null {
  const look = p && lookOf(p, gender);
  if (!p || !look) return null;
  const box = document.createElement("div");
  box.className = `avatar-badge ${size}`;
  box.append(avatarCanvas(look, `${p.name} avatar`));
  return box;
}
