const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../../games/kochan-3d-arcade');

// Read only scripts actually loaded by the shipped page, so tests cannot silently
// exercise a stale copy that the browser no longer uses.
module.exports = function readSource(name) {
  if (!/^[a-z-]+\.js$/.test(name)) throw new Error('Invalid script name');
  const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
  if (!new RegExp(`<script\\s+src="${name.replace('.', '\\.')}"\\s*>`).test(html)) throw new Error(`Page does not load ${name}`);
  return fs.readFileSync(path.join(directory, name), 'utf8');
};
