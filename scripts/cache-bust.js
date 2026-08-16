/**
 * Stamp local CSS/JS/image URLs in HTML with a build id so GitHub Pages
 * and browsers fetch a fresh copy after each deploy.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
const version = String(process.env.GITHUB_SHA || process.env.TCV_BUILD || Date.now()).slice(0, 12);

const SKIP_DIR = new Set(['.git', '.github', 'node_modules', 'dist', 'scripts']);
const ATTR_RE =
  /(href|src)="((?!https?:\/\/|\/\/|data:|mailto:)[^"?]+?\.(?:css|js|png|jpe?g|svg|webp|ico|gif))(?:\?[^"]*)?"/gi;

const META =
  '  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n' +
  '  <meta http-equiv="Pragma" content="no-cache">\n' +
  '  <meta http-equiv="Expires" content="0">';

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (SKIP_DIR.has(entry.name)) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  });
  return out;
}

const files = walk(root, []);
files.forEach((file) => {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(ATTR_RE, (_, attr, url) => attr + '="' + url + '?v=' + version + '"');
  if (!/http-equiv=["']Cache-Control["']/i.test(html)) {
    html = html.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, '$1\n' + META);
  }
  fs.writeFileSync(file, html);
});

process.stdout.write('Cache-busted ' + files.length + ' HTML files with v=' + version + '\n');
