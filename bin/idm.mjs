#!/usr/bin/env node
// idm — author Idomoo IDM videos from compact scene JSON, compile locally, render to MP4.
//
// Ships as a standalone binary (Node SEA): everything is statically imported so
// esbuild can bundle a single CJS file — no package.json reads, no dynamic paths.
//
// Agent-first: --json puts machine-readable results on stdout, errors go to stderr,
// exit codes are stable, and nothing reads a TTY unless run interactively.
//
// Exit codes: 0 ok · 1 compile/schema error · 2 missing asset/file · 3 auth · 4 render timeout

// the vendored codec uses legacy Buffer() constructors — silence the noise for users
process.noDeprecation = true;

import { readFileSync, writeFileSync, mkdirSync, renameSync, chmodSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { vasco2idm, idm2vasco, schema } from 'vasco';
import Ajv from 'ajv';
import { compileScene } from '../src/compile.mjs';
import { resolveCredentials, storeCredentials, CRED_PATH } from '../src/auth.mjs';
import { renderIdm, download, getToken, listLibraries } from '../src/render.mjs';
import { VERSION, REPO, RAW } from '../src/version.mjs';

const args = process.argv.slice(2);

// `idm scene.json` / `idm file.idm` — a bare file arg implies the command.
const COMMANDS = ['compile', 'build', 'validate', 'inspect', 'init', 'render',
    'auth', 'library', 'schema', 'skill', 'update', 'help', 'version'];
if (args[0] && !COMMANDS.includes(args[0]) && !args[0].startsWith('-')) {
    if (/\.json$/i.test(args[0])) args.unshift('compile');
    else if (/\.idm$/i.test(args[0])) args.unshift('inspect');
}
const cmd = args[0];

const JSON_MODE = args.includes('--json');

const flag = name => args.includes(name);
function opt(name, dflt) {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
function out(obj, human) {
    if (JSON_MODE) console.log(JSON.stringify(obj, null, 2));
    else console.log(human ?? JSON.stringify(obj, null, 2));
}
function fail(msg, code = 1) {
    if (JSON_MODE) console.error(JSON.stringify({ error: String(msg) }));
    else console.error('❌ ' + msg);
    process.exit(code);
}

const apiBase = () => opt('--base', process.env.IDOMOO_API_BASE ?? 'https://usa-api.idomoo.com/api/v3');

function loadAndCompile(scenePath) {
    const abs = resolve(scenePath);
    let scene;
    try {
        scene = JSON.parse(readFileSync(abs, 'utf8'));
    } catch (e) {
        fail(`Cannot read scene "${abs}": ${e.message}`, 2);
    }
    let doc;
    try {
        doc = compileScene(scene, dirname(abs));
    } catch (e) {
        fail(`Compile error: ${e.message}`, /Asset not found/.test(e.message) ? 2 : 1);
    }
    const ajv = new Ajv({ allowUnionTypes: true });
    if (!ajv.validate(schema, doc)) {
        const errs = (ajv.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`);
        if (JSON_MODE) console.error(JSON.stringify({ error: 'schema validation failed', details: errs }));
        else {
            console.error('Schema validation failed on compiled VASCO:');
            for (const e of errs) console.error('  ' + e);
        }
        process.exit(1);
    }
    return { scene, doc, abs };
}

function summary(doc) {
    const c = doc.compositions[doc.entry_point];
    return {
        size: `${c.width}x${c.height}`,
        fps: c.fps ?? 25,
        frames: c.num_of_frames,
        duration_s: Math.round(c.num_of_frames / (c.fps ?? 25) * 100) / 100,
        comps: doc.compositions.length,
        layers: c.layers.length,
        assets: doc.assets.length,
        animations: doc.animations.length,
        effects: doc.effects.length,
        masks: doc.masks.length,
    };
}
function printSummary(doc) {
    const s = summary(doc);
    console.log(`   ${s.size} @ ${s.fps}fps, ${s.frames} frames (${s.duration_s}s)`);
    console.log(`   comps: ${s.comps}, layers: ${s.layers}, assets: ${s.assets}, animations: ${s.animations}, effects: ${s.effects}, masks: ${s.masks}`);
}

function getCreds() {
    const creds = resolveCredentials({ account: opt('--account'), token: opt('--token') });
    if (!creds)
        fail('No Idomoo credentials. Run `idm auth login`, set IDOMOO_ACCOUNT_ID / IDOMOO_SECRET_KEY, or pass --account/--token.', 3);
    return creds;
}

function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise(res => rl.question(question, a => { rl.close(); res(a.trim()); }));
}

async function bearerHeaders(creds) {
    const token = await getToken(apiBase(), creds.account_id, creds.secret_key);
    return { Accept: 'application/json', Authorization: `Bearer ${token}` };
}

function platformAsset() {
    const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
    const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
    if (!os || !arch) return null;
    return `idm_${os}_${arch}${process.platform === 'win32' ? '.exe' : ''}`;
}

async function isSeaBinary() {
    try {
        const sea = await import('node:sea');
        return sea.isSea();
    } catch {
        return false;
    }
}

async function main() {
    switch (cmd) {
        case 'compile':
        case 'build': {
            const scenePath = args[1];
            if (!scenePath) fail('Usage: idm compile <scene.json> [-o out.idm] [--vasco] [--json]');
            const { doc, abs } = loadAndCompile(scenePath);
            const outPath = resolve(opt('-o', opt('--out', abs.replace(/\.json$/i, '') + '.idm')));
            mkdirSync(dirname(outPath), { recursive: true });
            if (flag('--vasco'))
                writeFileSync(outPath.replace(/\.idm$/i, '') + '.vasco.json', JSON.stringify(doc, null, 2));
            try {
                vasco2idm(doc, outPath);
            } catch (e) {
                fail(`vasco2idm failed: ${e?.message ?? e}`);
            }
            if (JSON_MODE) out({ ok: true, idm_path: outPath, ...summary(doc) });
            else { console.log(`✅ wrote ${outPath}`); printSummary(doc); }
            break;
        }

        case 'validate': {
            const scenePath = args[1];
            if (!scenePath) fail('Usage: idm validate <scene.json> [--print] [--json]');
            const { doc } = loadAndCompile(scenePath);
            if (flag('--print')) console.log(JSON.stringify(doc, null, 2));
            if (JSON_MODE) out({ ok: true, valid: true, ...summary(doc) });
            else { console.log('✅ scene compiles to valid VASCO'); printSummary(doc); }
            break;
        }

        case 'inspect': {
            const idmPath = args[1];
            if (!idmPath) fail('Usage: idm inspect <file.idm> [--assets <dir>]');
            let buffer;
            try {
                buffer = readFileSync(resolve(idmPath));
            } catch (e) {
                fail(`Cannot read "${idmPath}": ${e.message}`, 2);
            }
            const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            const assets = new Map();
            const doc = idm2vasco(view, assets);
            console.log(JSON.stringify(doc, null, 2));
            const assetDir = opt('--assets');
            if (assetDir) {
                mkdirSync(resolve(assetDir), { recursive: true });
                for (const [name, data] of assets)
                    writeFileSync(resolve(assetDir, basename(name)), data);
                console.error(`(extracted ${assets.size} asset(s) to ${resolve(assetDir)})`);
            }
            break;
        }

        case 'render': {
            const input = args[1];
            if (!input) fail(`Usage: idm render <scene.json|file.idm> --library <name-or-id> [-o out.mp4]
                  [--height <px>] [--quality <n>] [--base <api url>] [--account <id>] [--token <secret>] [--json]`);
            const creds = getCreds();

            // The Idomoo library to upload into is the user's choice — never silently default.
            let library = opt('--library');
            if (!library) {
                let libs = [];
                try {
                    libs = await listLibraries(apiBase(), await bearerHeaders(creds));
                } catch (e) {
                    fail(`Cannot list libraries: ${e.message}`, 3);
                }
                if (process.stdin.isTTY && !JSON_MODE) {
                    console.log('Which Idomoo library should this upload to?');
                    libs.forEach((l, i) => console.log(`  ${i + 1}. ${l.name} (id ${l.id})`));
                    const answer = await ask(`Pick a number, or type a name${libs.length ? '' : ' (a new library will be created)'}: `);
                    const idx = Number(answer);
                    library = Number.isInteger(idx) && idx >= 1 && idx <= libs.length ? libs[idx - 1].name : answer;
                    if (!library) fail('A library is required.', 1);
                } else {
                    const listing = libs.map(l => `${l.name} (id ${l.id})`).join(', ') || '(none yet)';
                    fail(`--library is required. Ask the user which library to upload to, or a name for a new one. Existing libraries: ${listing}`, 1);
                }
            }

            let idmBytes, filename, doc = null;
            if (/\.idm$/i.test(input)) {
                try {
                    idmBytes = readFileSync(resolve(input));
                } catch (e) {
                    fail(`Cannot read "${input}": ${e.message}`, 2);
                }
                filename = basename(input);
            } else {
                const compiled = loadAndCompile(input);
                doc = compiled.doc;
                const idmPath = compiled.abs.replace(/\.json$/i, '') + '.idm';
                try {
                    vasco2idm(doc, idmPath);
                } catch (e) {
                    fail(`vasco2idm failed: ${e?.message ?? e}`);
                }
                if (!JSON_MODE) console.log(`📦 compiled ${idmPath}`);
                idmBytes = readFileSync(idmPath);
                filename = basename(idmPath);
            }

            const comp = doc ? doc.compositions[doc.entry_point] : null;
            const outHeight = Number(opt('--height', comp ? String(comp.height) : '1080'));
            const quality = Number(opt('--quality', '26'));
            const outPath = resolve(opt('-o', opt('--out', filename.replace(/\.idm$/i, '') + '.mp4')));

            try {
                const { videoUrl, posterUrl } = await renderIdm({
                    idmBytes, filename,
                    accountId: creds.account_id, secret: creds.secret_key,
                    base: apiBase(), libraryName: library,
                    outHeight, quality,
                    log: m => { if (!JSON_MODE) console.log('  ' + m); },
                });
                if (!JSON_MODE) console.log('⬇️  downloading MP4...');
                mkdirSync(dirname(outPath), { recursive: true });
                await download(videoUrl, outPath);
                if (JSON_MODE) out({ ok: true, mp4_path: outPath, video_url: videoUrl, poster_url: posterUrl });
                else {
                    console.log(`✅ wrote ${outPath}`);
                    console.log(`   video:  ${videoUrl}`);
                    if (posterUrl) console.log(`   poster: ${posterUrl}`);
                }
            } catch (e) {
                const msg = e?.message ?? String(e);
                fail(msg, /OAuth failed/.test(msg) ? 3 : /timed out/.test(msg) ? 4 : 1);
            }
            break;
        }

        case 'auth': {
            const sub = args[1];
            if (sub === 'login') {
                let account = opt('--account'), token = opt('--token');
                if (!account || !token) {
                    if (!process.stdin.isTTY)
                        fail('Non-interactive: pass --account <id> --token <secret>.', 3);
                    account = account ?? await ask('Idomoo account id: ');
                    token = token ?? await ask('Idomoo secret key: ');
                }
                if (!account || !token) fail('Both account id and secret key are required.', 3);
                try {
                    await getToken(apiBase(), account, token);
                } catch (e) {
                    fail(`Credentials rejected by ${apiBase()}: ${e.message}`, 3);
                }
                const path = storeCredentials(account, token);
                out({ ok: true, account_id: account, credentials: path },
                    `✅ authenticated as account ${account} — saved to ${path}`);
                break;
            }
            if (sub === 'status') {
                const creds = resolveCredentials({ account: opt('--account'), token: opt('--token') });
                if (!creds) fail(`Not authenticated. Run \`idm auth login\` or set IDOMOO_ACCOUNT_ID / IDOMOO_SECRET_KEY. (checked env, ${CRED_PATH})`, 3);
                try {
                    await getToken(apiBase(), creds.account_id, creds.secret_key);
                } catch (e) {
                    fail(`Credentials from ${creds.source} were rejected: ${e.message}`, 3);
                }
                out({ ok: true, account_id: creds.account_id, source: creds.source, base: apiBase() },
                    `✅ authenticated as account ${creds.account_id} (credentials from ${creds.source})`);
                break;
            }
            fail('Usage: idm auth login [--account <id> --token <secret>] | idm auth status');
            break;
        }

        case 'library': {
            if (args[1] !== 'list') fail('Usage: idm library list [--json]');
            const creds = getCreds();
            try {
                const libs = await listLibraries(apiBase(), await bearerHeaders(creds));
                if (JSON_MODE) out({ ok: true, libraries: libs });
                else if (libs.length === 0) console.log('No libraries yet — `idm render --library <name>` will create one.');
                else for (const l of libs) console.log(`${l.id}\t${l.name}`);
            } catch (e) {
                fail(e.message, 3);
            }
            break;
        }

        case 'schema': {
            console.log(JSON.stringify(schema, null, 2));
            break;
        }

        case 'skill': {
            if (args[1] !== 'install')
                fail('Usage: idm skill install [--claude] [--codex]   (installs the idm-maker authoring skill for Claude Code and/or OpenAI Codex)');
            // Claude Code reads ~/.claude/skills, OpenAI Codex reads ~/.codex/skills —
            // same SKILL.md format. Default: Claude Code always, Codex when ~/.codex exists.
            const wantClaude = flag('--claude') || !flag('--codex');
            const wantCodex = flag('--codex') || (!flag('--claude') && existsSync(join(homedir(), '.codex')));
            const targets = [];
            if (wantClaude) targets.push(join(homedir(), '.claude', 'skills', 'idm-maker'));
            if (wantCodex) targets.push(join(homedir(), '.codex', 'skills', 'idm-maker'));
            const files = ['SKILL.md', 'references/format.md'];
            try {
                const contents = [];
                for (const f of files) {
                    const r = await fetch(`${RAW}/skills/idm-maker/${f}`);
                    if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${f}`);
                    contents.push([f, await r.text()]);
                }
                for (const dest of targets)
                    for (const [f, text] of contents) {
                        const path = join(dest, f);
                        mkdirSync(dirname(path), { recursive: true });
                        writeFileSync(path, text);
                    }
            } catch (e) {
                fail(`Skill install failed: ${e.message}`, 2);
            }
            out({ ok: true, installed: targets },
                targets.map(t => `✅ installed idm-maker skill to ${t}`).join('\n'));
            break;
        }

        case 'update': {
            if (!await isSeaBinary()) {
                fail('This is a dev checkout (not a standalone binary). Update with: git pull && npm install');
            }
            const asset = platformAsset();
            if (!asset) fail(`Unsupported platform ${process.platform}/${process.arch} — build from source.`);
            const url = `${REPO}/releases/latest/download/${asset}`;
            const exe = process.execPath;
            console.log(`Downloading ${url} ...`);
            try {
                await download(url, exe + '.new');
                if (process.platform !== 'win32') chmodSync(exe + '.new', 0o755);
                renameSync(exe, exe + '.old');
                renameSync(exe + '.new', exe);
                try { unlinkSync(exe + '.old'); } catch { /* locked while running on Windows — harmless */ }
                console.log(`✅ updated ${exe}`);
            } catch (e) {
                fail(`Update failed: ${e.message}`);
            }
            break;
        }

        case 'init': {
            const outPath = resolve(args[1] ?? 'scene.json');
            const starter = {
                width: 1280, height: 720, fps: 25, duration: 4,
                layers: [
                    { type: 'solid', name: 'bg', color: '#10204a' },
                    {
                        type: 'text', name: 'title',
                        text: 'Hello, IDM!',
                        font: './DejaVuSans.ttf', size: 96, color: '#ffffff',
                        box: [100, 260, 1080, 200], align: 'center middle',
                        animate: {
                            opacity: [{ t: 0, v: 0 }, { t: 0.8, v: 1, ease: 'outCubic' }],
                            position: [{ t: 0, v: [0, 60], ease: 'outCubic' }, { t: 0.8, v: [0, 0] }],
                        },
                    },
                ],
            };
            writeFileSync(outPath, JSON.stringify(starter, null, 2));
            console.log(`✅ wrote ${outPath} — point "font" at a real .ttf, then: idm compile ${args[1] ?? 'scene.json'}`);
            break;
        }

        case 'version':
        case '--version':
        case '-v':
            console.log(VERSION);
            break;

        default:
            console.log(`
▄▄ ▄▄▄▄   ▄▄▄  ▄▄   ▄▄  ▄▄▄   ▄▄▄    ▄▄ ▄▄  ▄▄▄   ▄▄▄▄  ▄▄▄▄  ▄▄▄
██ ██▀██ ██▀██ ██▀▄▀██ ██▀██ ██▀██   ██▄██ ██▀██ ███▄▄ ██▀▀▀ ██▀██
██ ████▀ ▀███▀ ██   ██ ▀███▀ ▀███▀    ▀█▀  ██▀██ ▄▄██▀ ▀████ ▀███▀

idm v${VERSION} — author Idomoo IDM videos from compact scene JSON, locally

Usage:
  idm <scene.json>                                   shorthand for compile
  idm <file.idm>                                     shorthand for inspect
  idm compile  <scene.json> [-o out.idm] [--vasco]   scene -> .idm (schema-validated)
  idm validate <scene.json> [--print]                compile + schema-check, no output file
  idm inspect  <file.idm>   [--assets <dir>]         decode .idm back to vasco JSON
  idm render   <scene.json|file.idm> --library <name-or-id> [-o out.mp4]
               [--height <px>] [--quality <n>] [--base <url>]
                                                     upload to Idomoo, render, download MP4
                                                     (asks which library when run interactively)
  idm library  list                                  list Idomoo libraries (id + name)
  idm init     [scene.json]                          write a starter scene
  idm auth     login | status                        manage Idomoo credentials (~/.idm/credentials)
  idm schema                                         print the VASCO JSON Schema
  idm skill    install                               install the idm-maker agent skill (~/.claude/skills)
  idm update                                         self-update to the latest release
  idm version

Auth resolution: --account/--token > IDOMOO_ACCOUNT_ID/IDOMOO_SECRET_KEY env > ~/.idm/credentials
Global flags: --json (machine-readable stdout)
Exit codes: 0 ok · 1 compile/schema · 2 missing file · 3 auth · 4 render timeout`);
            process.exit(cmd && cmd !== 'help' ? 1 : 0);
    }
}

main().catch(e => fail(e?.message ?? String(e)));
