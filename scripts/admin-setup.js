#!/usr/bin/env node
// ════════════════════════════════════════════════════════
// ÆTHNOUS Admin Setup — Drive appData category tree (Sprint 3.9 H6.1)
//
// One-time (idempotent) bootstrap for Blue's owner account:
//   1. Ensures 5 default category folders exist in appDataFolder
//   2. Writes categories.json (folder ↔ slug ↔ displayName mapping)
//
// Usage:
//   1. Sign in on chart.aethnous.co (or http://localhost:4399 if OAuth allows)
//   2. DevTools Console:  copy(Cloud.token)
//   3. Terminal:          ACCESS_TOKEN=<paste> node scripts/admin-setup.js
//
// Re-runnable safely — existing folders / categories are detected and skipped.
// Token expires in ~1 hour; if it expires mid-run just rerun with a fresh one.
//
// Design notes:
//   - English slugs (filesystem-safe, future i18n via displayName)
//   - displayName is editable from UI later (Phase 2 H4 modal)
//   - default: true protects against accidental UI deletion of seed categories
//   - Physical folders are created now so future shard-by-folder migration is cheap;
//     for now cloud.js still uses a single aethnous-charts.json with categoryId field.
// ════════════════════════════════════════════════════════

'use strict';

const DEFAULT_CATEGORIES = [
  { slug: 'self',       displayName: 'Self',       icon: '我' },
  { slug: 'partner',    displayName: 'Partner',    icon: '伴' },
  { slug: 'family',     displayName: 'Family',     icon: '家' },
  { slug: 'client',     displayName: 'Client',     icon: '客' },
  { slug: 'case_study', displayName: 'Case Study', icon: '例' },
];

const CATEGORIES_FILENAME = 'aethnous-categories.json';
const DRIVE_API = 'https://www.googleapis.com';
const UPLOAD_API = 'https://www.googleapis.com/upload';

const token = process.env.ACCESS_TOKEN;
if (!token) {
  console.error('❌ Missing ACCESS_TOKEN env var.');
  console.error('   1. Sign in on chart.aethnous.co');
  console.error('   2. DevTools Console: copy(Cloud.token)');
  console.error('   3. Run: ACCESS_TOKEN=<paste> node scripts/admin-setup.js');
  process.exit(1);
}

function newId() {
  return 'cat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

async function driveApi(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status} ${res.statusText}: ${txt.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function findFolder(slug) {
  const q = `name='${slug}' and 'appDataFolder' in parents and ` +
    `mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const data = await driveApi(
    `${DRIVE_API}/drive/v3/files?spaces=appDataFolder` +
    `&q=${encodeURIComponent(q)}&fields=files(id,name)`
  );
  return data.files && data.files[0] ? data.files[0] : null;
}

async function createFolder(slug) {
  return driveApi(`${DRIVE_API}/drive/v3/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: slug,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['appDataFolder'],
    }),
  });
}

async function findCategoriesFile() {
  const q = `name='${CATEGORIES_FILENAME}' and 'appDataFolder' in parents and trashed=false`;
  const data = await driveApi(
    `${DRIVE_API}/drive/v3/files?spaces=appDataFolder` +
    `&q=${encodeURIComponent(q)}&fields=files(id,name)`
  );
  return data.files && data.files[0] ? data.files[0] : null;
}

async function readCategoriesFile(fileId) {
  const res = await fetch(`${DRIVE_API}/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Read categories.json failed: ${res.status}`);
  return res.json();
}

async function uploadCategoriesFile(existingId, store) {
  const body = JSON.stringify(store, null, 2);
  if (existingId) {
    const res = await fetch(
      `${UPLOAD_API}/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      }
    );
    if (!res.ok) throw new Error(`Update categories.json failed: ${res.status}`);
    return existingId;
  }
  // multipart create
  const meta = { name: CATEGORIES_FILENAME, parents: ['appDataFolder'] };
  const boundary = '----aethnous' + Date.now();
  const multipart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(meta) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    body + '\r\n' +
    `--${boundary}--`;
  const res = await fetch(`${UPLOAD_API}/drive/v3/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipart,
  });
  if (!res.ok) throw new Error(`Create categories.json failed: ${res.status}`);
  const json = await res.json();
  return json.id;
}

async function main() {
  console.log('🖤 ÆTHNOUS admin setup — initializing default category tree');
  console.log('━'.repeat(56));

  // 1. Ensure folders
  const folderResults = [];
  for (const cat of DEFAULT_CATEGORIES) {
    let f = await findFolder(cat.slug);
    let created = false;
    if (!f) {
      f = await createFolder(cat.slug);
      created = true;
    }
    folderResults.push({ ...cat, folderId: f.id, created });
    const mark = created ? '✨ created' : '✓ exists ';
    console.log(`  ${mark}  ${cat.displayName.padEnd(12)} (${cat.slug.padEnd(11)})  id=${f.id}`);
  }

  // 2. Ensure categories.json
  console.log('━'.repeat(56));
  let catFile = await findCategoriesFile();
  let store;
  if (catFile) {
    store = await readCategoriesFile(catFile.id);
    if (!store || store.version !== 1 || !Array.isArray(store.categories)) {
      console.log('⚠ existing categories.json is invalid; resetting');
      store = { version: 1, categories: [], updatedAt: new Date().toISOString() };
    } else {
      console.log(`✓ existing categories.json found  (${store.categories.length} entries)`);
    }
  } else {
    store = { version: 1, categories: [], updatedAt: new Date().toISOString() };
    console.log('✨ no categories.json yet — will create');
  }

  // 3. Merge default categories (idempotent: keep existing IDs / displayName edits)
  const nowIso = new Date().toISOString();
  let mergedCount = 0;
  for (const f of folderResults) {
    const existing = store.categories.find(c => c.slug === f.slug);
    if (existing) {
      // Update folderId in case it changed; preserve displayName / icon edits.
      existing.folderId = f.folderId;
      existing.default = true;
      continue;
    }
    store.categories.push({
      id: newId(),
      slug: f.slug,
      displayName: f.displayName,
      icon: f.icon,
      default: true,
      folderId: f.folderId,
      createdAt: nowIso,
    });
    mergedCount++;
  }
  store.updatedAt = nowIso;

  // 4. Upload
  const finalId = await uploadCategoriesFile(catFile ? catFile.id : null, store);
  console.log('━'.repeat(56));
  console.log(`✅ categories.json saved  (id=${finalId}, +${mergedCount} new, total=${store.categories.length})`);
  console.log('');
  console.log('Next: Phase 2 H4 (UI hook into categories) — see Sprint 3.9 hotfix spec.');
}

main().catch(err => {
  console.error('');
  console.error('❌ admin-setup failed:', err.message);
  if (err.message.includes('401') || err.message.includes('403')) {
    console.error('   Token likely expired or insufficient scope.');
    console.error('   Required scope: https://www.googleapis.com/auth/drive.appdata');
    console.error('   Resign in and grab a fresh token.');
  }
  process.exit(1);
});
