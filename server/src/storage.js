import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Storage adapter interface (S3-ready). Swapping STORAGE_DRIVER=s3 changes nothing
 * in the routes — they only touch this contract:
 *   put(key, srcPath)         -> move/upload the temp file at srcPath to `key`
 *   createReadStream(key,rng) -> Readable for the object (rng = {start,end} bytes)
 *   stat(key)                 -> { size }
 *   remove(key)               -> delete the object (best-effort)
 */

function assertSafeKey(key) {
  // Keys are "<userId>/<uuid><ext>" — reject traversal (Checklist: user-scoped paths).
  if (typeof key !== 'string' || key.includes('..') || path.isAbsolute(key)) {
    throw new Error('unsafe storage key');
  }
}

class LocalAdapter {
  constructor(baseDir) {
    this.baseDir = baseDir;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  _full(key) {
    assertSafeKey(key);
    return path.join(this.baseDir, key);
  }

  async put(key, srcPath) {
    const dest = this._full(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fsp.rename(srcPath, dest); // fast path: same volume
    } catch (e) {
      if (e.code === 'EXDEV') {
        await fsp.copyFile(srcPath, dest); // cross-device fallback
        await fsp.unlink(srcPath).catch(() => {});
      } else {
        throw e;
      }
    }
  }

  createReadStream(key, range) {
    const full = this._full(key);
    return fs.createReadStream(full, range ? { start: range.start, end: range.end } : undefined);
  }

  async stat(key) {
    const s = await fsp.stat(this._full(key));
    return { size: s.size };
  }

  async remove(key) {
    await fsp.unlink(this._full(key)).catch((e) => {
      if (e.code !== 'ENOENT') logger.warn('local remove failed', { code: e.code });
    });
  }

  // Provide a real on-disk path (for ffmpeg / pdf renderers). No-op cleanup locally.
  async getLocalFile(key) {
    return { path: this._full(key), cleanup: async () => {} };
  }

  async putBuffer(key, buf) {
    const dest = this._full(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, buf);
  }

  async getBuffer(key) {
    return fsp.readFile(this._full(key));
  }
}

class S3Adapter {
  constructor(s3cfg) {
    this.cfg = s3cfg;
    this._client = null;
    this._sdk = null;
  }

  async _load() {
    if (this._client) return;
    // Lazy import so the heavy AWS SDK is only required when STORAGE_DRIVER=s3.
    const sdk = await import('@aws-sdk/client-s3');
    this._sdk = sdk;
    this._client = new sdk.S3Client({
      region: this.cfg.region,
      endpoint: this.cfg.endpoint || undefined,
      forcePathStyle: Boolean(this.cfg.endpoint), // R2/MinIO
      credentials: {
        accessKeyId: this.cfg.accessKeyId,
        secretAccessKey: this.cfg.secretAccessKey,
      },
    });
  }

  async put(key, srcPath) {
    assertSafeKey(key);
    await this._load();
    const Body = fs.createReadStream(srcPath);
    await this._client.send(
      new this._sdk.PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body }),
    );
    await fsp.unlink(srcPath).catch(() => {});
  }

  createReadStream(key, range) {
    assertSafeKey(key);
    // Returns a Readable via a passthrough resolved from the async GetObject call.
    const pass = new PassThrough();
    (async () => {
      await this._load();
      const cmd = new this._sdk.GetObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      });
      const res = await this._client.send(cmd);
      res.Body.pipe(pass);
    })().catch((e) => pass.destroy(e));
    return pass;
  }

  async stat(key) {
    assertSafeKey(key);
    await this._load();
    const res = await this._client.send(
      new this._sdk.HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
    return { size: Number(res.ContentLength || 0) };
  }

  async remove(key) {
    assertSafeKey(key);
    await this._load();
    await this._client
      .send(new this._sdk.DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }))
      .catch((e) => logger.warn('s3 remove failed', { name: e.name }));
  }

  // Download to a temp file so ffmpeg/pdf renderers can read a real path.
  async getLocalFile(key) {
    const buf = await this.getBuffer(key);
    const tmp = path.join(os.tmpdir(), `magdrive-${randomUUID()}${path.extname(key)}`);
    await fsp.writeFile(tmp, buf);
    return { path: tmp, cleanup: async () => fsp.unlink(tmp).catch(() => {}) };
  }

  async putBuffer(key, buf) {
    assertSafeKey(key);
    await this._load();
    await this._client.send(
      new this._sdk.PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: buf }),
    );
  }

  async getBuffer(key) {
    assertSafeKey(key);
    await this._load();
    const res = await this._client.send(
      new this._sdk.GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
    const chunks = [];
    for await (const c of res.Body) chunks.push(c);
    return Buffer.concat(chunks);
  }
}

export const storage =
  config.storageDriver === 's3'
    ? new S3Adapter(config.s3)
    : new LocalAdapter(config.localStorageDir);

logger.info('storage adapter ready', { driver: config.storageDriver });
