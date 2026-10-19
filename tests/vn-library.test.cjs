const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('document library exposes the shared visual novel asset page', () => {
  const html = read('index.html');
  assert.match(html, /onclick="OCVnLibrary\.open\(\)"/);
  assert.match(html, /src="vn-library\.js/);
  assert.match(html, /href="vn-library\.css/);
  assert.match(read('service-worker.js'), /"\.\/vn-library\.js"/);
});

test('asset manager and editor use the same mediaLibrary records', () => {
  const library = read('vn-library.js');
  const editor = read('vn-assets.js');
  assert.match(library, /mediaLibrary\.filter\(row=>row\?\.kind==='vn-asset'/);
  assert.match(editor, /mediaLibrary\.filter\(row=>row\?\.kind==='vn-asset'/);
  assert.match(editor, /vnAssetFolderFilter/);
  assert.match(editor, /OCVnLibrary\.open\(item\.assetType,item\.id\)/);
  assert.match(library, /portraitFrame/);
  assert.doesNotMatch(library, /\bprompt\(/);
});

test('CP detail controls include an all-toggle and inset card button', () => {
  assert.match(read('index.html'), /id="toggleAllCpDetails"/);
  assert.match(read('app.js'), /function toggleAllCpCardDetails\(/);
  assert.match(read('style.css'), /\.cp-card-details-toggle\{[^}]*right:\.75rem/);
});
