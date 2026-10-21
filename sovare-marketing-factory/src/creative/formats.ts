/**
 * Formatos de salida y sus zonas seguras.
 *
 * Las zonas seguras son el margen que tapan la interfaz de Instagram/Facebook
 * (nombre de la cuenta arriba, copy y botones abajo en Reels y Stories). El
 * texto importante nunca cae ahí.
 */

export interface Format {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  /** Márgenes seguros en px: arriba, derecha, abajo, izquierda. */
  safe: [number, number, number, number];
  placements: string[];
}

export type FormatId = 'reels_9x16' | 'feed_4x5' | 'square_1x1' | 'landscape_16x9';

export const FORMATS: Record<FormatId, Format> = {
  reels_9x16: { id: 'reels_9x16', label: 'Reels / Stories 9:16', width: 1080, height: 1920, safe: [250, 70, 400, 70], placements: ['instagram_reels', 'instagram_stories', 'facebook_reels', 'facebook_stories'] },
  feed_4x5: { id: 'feed_4x5', label: 'Feed 4:5', width: 1080, height: 1350, safe: [70, 70, 90, 70], placements: ['instagram_feed', 'facebook_feed'] },
  square_1x1: { id: 'square_1x1', label: 'Cuadrado 1:1', width: 1080, height: 1080, safe: [60, 60, 70, 60], placements: ['instagram_feed', 'facebook_feed', 'marketplace'] },
  landscape_16x9: { id: 'landscape_16x9', label: 'Horizontal 16:9', width: 1920, height: 1080, safe: [70, 90, 80, 90], placements: ['facebook_in_stream', 'facebook_feed'] },
};

export const isFormat = (s: string): s is FormatId => s in FORMATS;
