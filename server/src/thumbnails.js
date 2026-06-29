import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import { logger } from './logger.js';

const THUMB_W = 512; // max thumbnail width
const JPEG_Q = 72;

// Generators are loaded lazily and independently — a missing/broken one only
// disables that file kind (status 'unsupported'), never crashes the server.
let _sharp;
async function getSharp() {
  if (_sharp === undefined) {
    try { _sharp = (await import('sharp')).default; }
    catch (e) { _sharp = null; logger.warn('sharp unavailable', { msg: e.message }); }
  }
  return _sharp;
}

let _ffmpegPath;
async function getFfmpeg() {
  if (_ffmpegPath === undefined) {
    try { _ffmpegPath = (await import('@ffmpeg-installer/ffmpeg')).default.path; }
    catch (e) { _ffmpegPath = null; logger.warn('ffmpeg unavailable', { msg: e.message }); }
  }
  return _ffmpegPath;
}

let _pdf;
async function getPdf() {
  if (_pdf === undefined) {
    try { _pdf = (await import('pdf-to-img')).pdf; }
    catch (e) { _pdf = null; logger.warn('pdf-to-img unavailable', { msg: e.message }); }
  }
  return _pdf;
}

async function fromImage(srcPath) {
  const sharp = await getSharp();
  if (!sharp) return null;
  return sharp(srcPath)
    .rotate() // respect EXIF orientation
    .resize({ width: THUMB_W, height: THUMB_W, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_Q })
    .toBuffer();
}

async function fromVideo(srcPath) {
  const ffmpeg = await getFfmpeg();
  const sharp = await getSharp();
  if (!ffmpeg || !sharp) return null;
  const out = path.join(os.tmpdir(), `magdrive-vt-${randomUUID()}.jpg`);
  try {
    await new Promise((resolve, reject) => {
      // Grab a frame ~1s in; if the clip is shorter, ffmpeg falls back to the first frame.
      const args = ['-y', '-ss', '1', '-i', srcPath, '-frames:v', '1', '-an', out];
      const p = spawn(ffmpeg, args, { stdio: 'ignore' });
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
    });
    const raw = await fsp.readFile(out);
    return sharp(raw).resize({ width: THUMB_W, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: JPEG_Q }).toBuffer();
  } finally {
    await fsp.unlink(out).catch(() => {});
  }
}

async function fromPdf(srcPath) {
  const pdf = await getPdf();
  const sharp = await getSharp();
  if (!pdf || !sharp) return null;
  const doc = await pdf(srcPath, { scale: 1.5 });
  const page1 = await doc.getPage(1); // PNG buffer
  return sharp(page1).resize({ width: THUMB_W, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: JPEG_Q }).toBuffer();
}

const KIND_GENERATOR = { image: fromImage, video: fromVideo, pdf: fromPdf };

export const THUMBNABLE = Object.keys(KIND_GENERATOR);

/**
 * Generate a JPEG thumbnail buffer for a file kind from a local source path.
 * Returns a Buffer, or null when the kind isn't thumbnailable / generator missing.
 */
export async function makeThumb(kind, srcPath) {
  const gen = KIND_GENERATOR[kind];
  if (!gen) return null;
  return gen(srcPath);
}
