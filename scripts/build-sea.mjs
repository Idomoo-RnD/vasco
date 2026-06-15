// Builds a standalone `strata` executable for the current platform using Node SEA:
//   1. esbuild bundles bin/strata.mjs (+ vasco codec, ajv) into one CJS file
//   2. node --experimental-sea-config generates the SEA blob
//   3. the blob is injected (postject) into a copy of the running node binary
//
// Output: dist/strata_<os>_<arch>[.exe]   (e.g. dist/strata_linux_amd64, dist/strata_windows_amd64.exe)

import { execSync } from 'child_process';
import { mkdirSync, rmSync, copyFileSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const osName = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
const archName = { x64: 'amd64', arm64: 'arm64' }[process.arch];
if (!osName || !archName) {
    console.error(`Unsupported platform: ${process.platform}/${process.arch}`);
    process.exit(1);
}
const ext = process.platform === 'win32' ? '.exe' : '';
const outBin = join('dist', `strata_${osName}_${archName}${ext}`);

const run = (cmd) => {
    console.log(`$ ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
};

rmSync('build', { recursive: true, force: true });
mkdirSync('build', { recursive: true });
mkdirSync('dist', { recursive: true });

// 1. bundle
run('npx esbuild bin/strata.mjs --bundle --platform=node --format=cjs --outfile=build/strata.cjs --log-level=warning');

// 2. SEA blob
writeFileSync('build/sea-config.json', JSON.stringify({
    main: 'build/strata.cjs',
    output: 'build/sea.blob',
    disableExperimentalSEAWarning: true,
}, null, 2));
run('node --experimental-sea-config build/sea-config.json');

// 3. inject into a copy of this node binary
copyFileSync(process.execPath, outBin);
if (process.platform === 'darwin') {
    try { run(`codesign --remove-signature "${outBin}"`); } catch { /* unsigned node is fine */ }
}
const machoFlag = process.platform === 'darwin' ? ' --macho-segment-name NODE_SEA' : '';
run(`npx postject "${outBin}" NODE_SEA_BLOB build/sea.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2${machoFlag}`);
if (process.platform === 'darwin') {
    run(`codesign --sign - "${outBin}"`);
}

const mb = (statSync(outBin).size / 1024 / 1024).toFixed(1);
console.log(`\nbuilt ${outBin} (${mb} MB)`);
