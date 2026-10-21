/**
 * Render de video: Chromium dibuja cada cuadro, FFmpeg lo codifica.
 *
 * El navegador se abre con la página del proyecto; por cada cuadro se llama a
 * `__render(t)`, se saca una captura JPEG y se pasa por un pipe a FFmpeg. Sale
 * un MP4 H.264 (yuv420p, 30 fps, +faststart) con una pista de audio AAC en
 * silencio —algunas ubicaciones rechazan videos sin pista de audio—, el póster
 * y los subtítulos.
 *
 * Los cuadros de las grabaciones reales se extraen una vez y quedan en caché
 * por recurso (`out/cache/frames/<asset>-<huella>`).
 */

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import { SmfError } from '../core/util.ts';
import { srt, type Project } from './project.ts';
import { projectHtml } from './template.ts';

export interface RenderOutput {
  dir: string;
  video: string;
  poster: string;
  captions: string;
  html: string;
  project: string;
  frames: number;
  ms: number;
}

/** Cuadros de una grabación a 30 fps, al ancho que se va a dibujar. */
export function recordingFrames(file: string, fps: number, maxWidth = 780): string[] {
  const h = createHash('sha1').update(file).update(String(statSync(file).mtimeMs)).update(String(fps)).digest('hex').slice(0, 10);
  const dir = join(config.outDir, 'cache', 'frames', h);
  if (!existsSync(join(dir, '.done'))) {
    mkdirSync(dir, { recursive: true });
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', file, '-vf', `fps=${fps},scale='min(${maxWidth},iw)':-2`, '-q:v', '3', join(dir, '%05d.jpg')], { stdio: 'pipe' });
    writeFileSync(join(dir, '.done'), new Date().toISOString());
  }
  return readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort().map((f) => join(dir, f));
}

export async function renderProject(project: Project, outDir: string, opts: { onProgress?: (frame: number, total: number) => void } = {}): Promise<RenderOutput> {
  if (!config.chromium) throw new SmfError('No se encontró Chromium para renderizar (definí CHROMIUM_PATH).', 'renderer_missing');
  const t0 = Date.now();
  mkdirSync(outDir, { recursive: true });
  const frames: Record<string, string[]> = {};
  for (const m of project.media) if (m.kind === 'recording') frames[m.assetId] = recordingFrames(m.file, project.fps);

  const projectPath = join(outDir, 'project.json');
  const htmlPath = join(outDir, 'index.html');
  const video = join(outDir, 'video.mp4');
  const poster = join(outDir, 'poster.jpg');
  const captions = join(outDir, 'captions.srt');
  writeFileSync(projectPath, JSON.stringify(project, null, 2));
  writeFileSync(htmlPath, projectHtml(project, frames));
  writeFileSync(captions, srt(project));

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: config.chromium, args: ['--allow-file-access-from-files', '--disable-web-security', '--font-render-hinting=none'] });
  const total = Math.round(project.duration * project.fps);
  const ff = spawn(
    config.ffmpeg,
    [
      '-v', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(project.fps), '-c:v', 'mjpeg', '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(project.fps),
      '-profile:v', 'high', '-level', '4.1',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      video,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let ffErr = '';
  ff.stderr.on('data', (d) => (ffErr += d));
  const ffDone = new Promise<void>((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new SmfError(`FFmpeg terminó con código ${code}: ${ffErr.slice(-500)}`, 'ffmpeg')))));

  try {
    const page = await browser.newPage({ viewport: { width: project.width, height: project.height }, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`);
    await page.evaluate(() => (window as unknown as { __ready: Promise<unknown> }).__ready);
    const posterAt = Math.round((project.timeline[0].end - 0.4) * project.fps);
    for (let i = 0; i < total; i++) {
      const t = i / project.fps;
      await page.evaluate((tt) => (window as unknown as { __render: (t: number) => void }).__render(tt), t);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (i === posterAt) writeFileSync(poster, buf);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      opts.onProgress?.(i + 1, total);
    }
  } finally {
    ff.stdin.end();
    await browser.close();
  }
  await ffDone;
  return { dir: outDir, video, poster, captions, html: htmlPath, project: projectPath, frames: total, ms: Date.now() - t0 };
}

export function readProject(path: string): Project {
  return JSON.parse(readFileSync(path, 'utf8')) as Project;
}
