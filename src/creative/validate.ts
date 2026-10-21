/**
 * Validación técnica del archivo, antes de subirlo a cualquier lado.
 *
 * Se mide con ffprobe lo que Meta exige o recomienda para Reels, Stories y
 * Feed: códec H.264, yuv420p, tamaño y relación de aspecto exactos, 30 fps,
 * duración, pista de audio AAC, peso. Además se mira que el video no tenga
 * cuadros negros o vacíos (un render roto suele dejar el primer segundo en
 * negro) comparando el brillo de varios cuadros.
 */

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { config } from '../config.ts';
import { FORMATS, type FormatId } from './formats.ts';

export interface Validation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  probe: {
    codec?: string;
    pix_fmt?: string;
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    audio?: string;
    bytes: number;
    bitrate_kbps?: number;
    luma?: number[];
  };
}

export function validateVideo(file: string, format: FormatId, expected: { duration?: number } = {}): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bytes = statSync(file).size;
  const raw = execFileSync(config.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
  const info = JSON.parse(raw) as { streams: Record<string, string | number>[]; format: Record<string, string> };
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const [num, den] = String(v?.r_frame_rate ?? '0/1').split('/').map(Number);
  const probe: Validation['probe'] = {
    codec: v?.codec_name as string,
    pix_fmt: v?.pix_fmt as string,
    width: Number(v?.width),
    height: Number(v?.height),
    fps: den ? num / den : 0,
    duration: Number(info.format.duration),
    audio: a?.codec_name as string | undefined,
    bytes,
    bitrate_kbps: Math.round(Number(info.format.bit_rate) / 1000),
  };
  const f = FORMATS[format];
  if (!v) errors.push('no tiene pista de video');
  if (probe.codec !== 'h264') errors.push(`códec ${probe.codec}, se espera h264`);
  if (probe.pix_fmt !== 'yuv420p') errors.push(`pix_fmt ${probe.pix_fmt}, se espera yuv420p`);
  if (probe.width !== f.width || probe.height !== f.height) errors.push(`mide ${probe.width}×${probe.height}, se espera ${f.width}×${f.height}`);
  if (Math.abs((probe.fps ?? 0) - 30) > 0.01) errors.push(`${probe.fps} fps, se esperan 30`);
  if (!probe.duration || probe.duration < 3) errors.push(`dura ${probe.duration}s (mínimo 3)`);
  if (probe.duration && probe.duration > 90) errors.push(`dura ${probe.duration}s: los Reels de anuncios admiten hasta 90 s`);
  if (expected.duration && Math.abs(probe.duration! - expected.duration) > 0.25) errors.push(`dura ${probe.duration}s, se esperaban ${expected.duration}`);
  if (!a) warnings.push('sin pista de audio');
  else if (probe.audio !== 'aac') errors.push(`audio ${probe.audio}, se espera aac`);
  if (bytes > 250 * 1024 * 1024) errors.push('pesa más de 250 MB');
  if (bytes < 50 * 1024) errors.push(`pesa ${bytes} bytes: probablemente esté vacío`);

  // Brillo medio de 5 cuadros repartidos: si alguno es negro o blanco plano, el render falló.
  try {
    const dur = probe.duration ?? 0;
    probe.luma = [0.12, 0.3, 0.5, 0.7, 0.92].map((k) => {
      const out = execFileSync(config.ffmpeg, ['-v', 'error', '-ss', (dur * k).toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=64:-2,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
      const sum = out.reduce((s, b) => s + b, 0);
      const mean = sum / out.length;
      const varianza = out.reduce((s, b) => s + (b - mean) ** 2, 0) / out.length;
      if (varianza < 20) errors.push(`el cuadro en ${(dur * k).toFixed(1)}s es plano (¿render vacío?)`);
      return Math.round(mean);
    });
  } catch (e) {
    warnings.push(`no se pudo medir el brillo: ${e instanceof Error ? e.message : e}`);
  }
  return { ok: errors.length === 0, errors, warnings, probe };
}
