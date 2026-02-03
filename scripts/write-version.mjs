import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const now = new Date();
const buildId = `${pkg.version || '0.0.0'}-${now.toISOString()}`;

const out = {
  name: pkg.name,
  version: pkg.version || '0.0.0',
  buildId,
  builtAt: now.toISOString(),
};

fs.mkdirSync(path.resolve('public'), { recursive: true });
fs.writeFileSync(path.resolve('public/version.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote public/version.json:', out);
