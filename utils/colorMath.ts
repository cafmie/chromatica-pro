import { RGB } from '../types';

export const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (rgb: RGB): string => {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

export const hsvToRgb = (h: number, s: number, v: number): RGB => {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
};

export const blendColors = (base: RGB, pigment: RGB, opacity: number): RGB => {
  return {
    r: base.r * (1 - opacity) + pigment.r * opacity,
    g: base.g * (1 - opacity) + pigment.g * opacity,
    b: base.b * (1 - opacity) + pigment.b * opacity,
  };
};

export const calculateColorDifference = (rgb1: RGB, rgb2: RGB): number => {
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
};

export const detectUndertone = (rgb: RGB): 'Warm' | 'Cool' | 'Neutral' => {
  const { r, g, b } = rgb;
  const rbRatio = r / (b || 1);
  if (rbRatio > 1.4) return 'Warm';
  if (rbRatio < 1.1) return 'Cool';
  return 'Neutral';
};