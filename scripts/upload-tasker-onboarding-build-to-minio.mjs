/**
 * Upload Tasker Onboarding frontend STATIC export (`out/`) to MinIO.
 *
 * Target layout:
 *   bucket: frontend-builds
 *     └── Tasker-OnBoarding-frontend/
 *           └── build-001/
 *                 └── index.html, login/, _next/, ...
 *
 * Prerequisites:
 *   next.config has `output: 'export'`
 *   run `npm run build` (creates `out/`)
 *
 * Usage:
 *   node scripts/upload-tasker-onboarding-build-to-minio.mjs
 *   node scripts/upload-tasker-onboarding-build-to-minio.mjs --version 1
 *   node scripts/upload-tasker-onboarding-build-to-minio.mjs --version 1 --dry-run
 *
 * Credentials: scripts/.env.minio-builds (or process env)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'minio';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(__dirname, '.env.minio-builds') });
dotenv.config({ path: path.join(ROOT, '.env.minio-builds') });

// Support both local script env names and GitHub Actions secret names
const BUCKET_NAME = String(
  process.env.MINIO_BUCKET || process.env.MINIO_BUCKET_NAME || 'frontend-builds',
).trim();
const APP_FOLDER = String(
  process.env.APP_FOLDER || 'Tasker-OnBoarding-frontend',
).trim();
const STATIC_EXPORT_DIR = path.join(ROOT, 'out');

function requireEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] ?? '').trim();
    if (value) return value;
  }
  throw new Error(`Missing required env var: one of ${names.join(', ')}`);
}

function normalizeEndpoint(raw) {
  let urlLike = String(raw || '').trim();
  if (!/^https?:\/\//i.test(urlLike)) urlLike = `https://${urlLike}`;
  const url = new URL(urlLike);
  return {
    endPoint: url.hostname,
    useSSL: url.protocol === 'https:',
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
  };
}

function parseArgs(argv) {
  // Default destination is `latest`. Use --version N for a numbered archive (build-00N).
  const args = { version: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--version' || arg === '-v') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) throw new Error('--version requires a number (e.g. 1)');
      args.version = Number(next);
      i += 1;
    }
  }
  if (args.version != null && (!Number.isInteger(args.version) || args.version < 1)) {
    throw new Error(`Invalid version: ${args.version}. Use a positive integer.`);
  }
  return args;
}

function formatBuildFolderName(version) {
  if (version == null) return 'latest';
  return `build-${String(version).padStart(3, '0')}`;
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'public, max-age=60';
  if (ext === '.js' || ext === '.css' || ext === '.woff' || ext === '.woff2') {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=86400';
}

function walkFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

async function ensureBucket(client, bucket) {
  const exists = await client.bucketExists(bucket);
  if (exists) {
    console.log(`✅ Bucket already exists: ${bucket}`);
    return false;
  }
  console.log(`📁 Creating bucket: ${bucket}`);
  await client.makeBucket(bucket, String(process.env.MINIO_REGION_NAME || '').trim() || undefined);
  console.log(`✅ Bucket created: ${bucket}`);
  return true;
}

async function putFolderMarker(client, bucket, prefix, dryRun) {
  const objectName = prefix.endsWith('/') ? prefix : `${prefix}/`;
  console.log(`📁 Ensuring remote folder marker: ${bucket}/${objectName}`);
  if (dryRun) {
    console.log(`   (dry-run) skip putObject for folder marker`);
    return;
  }
  await client.putObject(bucket, objectName, Buffer.alloc(0), 0, {
    'Content-Type': 'application/x-directory',
  });
  console.log(`✅ Remote folder ready: ${objectName}`);
}

function collectStaticExportFiles() {
  console.log('\n📦 Preparing static export upload...');
  console.log(`   Source (Next export): ${STATIC_EXPORT_DIR}`);

  if (!fs.existsSync(STATIC_EXPORT_DIR)) {
    throw new Error(`Missing static export folder: ${STATIC_EXPORT_DIR}. Run "npm run build" with output: 'export' first.`);
  }
  if (!fs.existsSync(path.join(STATIC_EXPORT_DIR, 'index.html'))) {
    throw new Error(`Missing index.html in ${STATIC_EXPORT_DIR}. Build may have failed.`);
  }

  const files = walkFiles(STATIC_EXPORT_DIR);
  console.log(`✅ Static export ready with ${files.length} files`);
  console.log(`   Entry: ${STATIC_EXPORT_DIR}${path.sep}index.html`);
  return files;
}

async function main() {
  const { version, dryRun } = parseArgs(process.argv);
  const buildFolder = formatBuildFolderName(version);
  const remoteAppPrefix = `${APP_FOLDER}`;
  const remoteBuildPrefix = `${APP_FOLDER}/${buildFolder}`;

  const endpointRaw = requireEnv('MINIO_ENDPOINT', 'MINIO_SERVER_URL');
  const { endPoint, useSSL, port } = normalizeEndpoint(endpointRaw);
  const accessKey = requireEnv('MINIO_ACCESS_KEY', 'MINIO_ROOT_USER');
  const secretKey = requireEnv('MINIO_SECRET_KEY', 'MINIO_ROOT_PASSWORD');
  const region = String(process.env.MINIO_REGION_NAME || '').trim() || undefined;

  console.log('══════════════════════════════════════════════════');
  console.log(' Tasker Onboarding Frontend → MinIO (static export)');
  console.log('══════════════════════════════════════════════════');
  console.log(`Endpoint:     ${endPoint}:${port} (ssl=${useSSL})`);
  console.log(`Bucket:       ${BUCKET_NAME}`);
  console.log(`App folder:   ${remoteAppPrefix}/`);
  console.log(`Build folder: ${remoteBuildPrefix}/`);
  console.log(`Version:      ${version == null ? 'latest (default)' : `${version} → ${buildFolder}`}`);
  console.log(`Source:       out/ (static HTML export)`);
  console.log(`Mode:         ${dryRun ? 'DRY RUN (no upload)' : 'UPLOAD'}`);
  console.log('══════════════════════════════════════════════════\n');

  const client = new Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
    region,
  });

  if (!dryRun) {
    await ensureBucket(client, BUCKET_NAME);
  } else {
    console.log(`📁 (dry-run) would ensure bucket: ${BUCKET_NAME}`);
  }

  console.log('\n📁 Creating remote folder structure...');
  console.log(`   1) ${BUCKET_NAME}/${remoteAppPrefix}/`);
  console.log(`   2) ${BUCKET_NAME}/${remoteBuildPrefix}/`);
  await putFolderMarker(client, BUCKET_NAME, remoteAppPrefix, dryRun);
  await putFolderMarker(client, BUCKET_NAME, remoteBuildPrefix, dryRun);

  const files = collectStaticExportFiles();

  console.log(`\n⬆️  Uploading static site into: ${BUCKET_NAME}/${remoteBuildPrefix}/`);
  let uploaded = 0;
  let failed = 0;

  for (const filePath of files) {
    const relative = toPosix(path.relative(STATIC_EXPORT_DIR, filePath));
    const objectName = `${remoteBuildPrefix}/${relative}`;

    try {
      if (dryRun) {
        console.log(`   (dry-run) ${objectName}`);
      } else {
        await client.fPutObject(BUCKET_NAME, objectName, filePath, {
          'Content-Type': mimeFor(filePath),
          'Cache-Control': cacheControlFor(filePath),
        });
        console.log(`   ✅ ${objectName}`);
      }
      uploaded += 1;
    } catch (err) {
      failed += 1;
      console.error(`   ❌ ${objectName}: ${err?.message || err}`);
    }
  }

  const serverUrl = String(
    process.env.MINIO_ENDPOINT || process.env.MINIO_SERVER_URL || '',
  ).replace(/\/+$/, '');
  console.log('\n══════════════════════════════════════════════════');
  console.log(' Upload summary');
  console.log('══════════════════════════════════════════════════');
  console.log(`Bucket:              ${BUCKET_NAME}`);
  console.log(`App folder created:  ${remoteAppPrefix}/`);
  console.log(`Build folder added:  ${remoteBuildPrefix}/`);
  console.log(`Build folder name:   ${buildFolder}`);
  console.log(`Files processed:     ${uploaded}`);
  console.log(`Failures:            ${failed}`);
  if (serverUrl) {
    console.log(`API base:            ${serverUrl}/${BUCKET_NAME}/${remoteBuildPrefix}/`);
    console.log(`Open site (index):   ${serverUrl}/${BUCKET_NAME}/${remoteBuildPrefix}/index.html`);
  }
  console.log('══════════════════════════════════════════════════');

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nFatal:', err?.message || err);
  process.exitCode = 1;
});
