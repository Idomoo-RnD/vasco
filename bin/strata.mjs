#!/usr/bin/env node
// strata — author Idomoo IDM videos from compact scene JSON, compile locally, render to MP4.
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

import { readFileSync, writeFileSync, mkdirSync, renameSync, chmodSync, unlinkSync, rmSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { vasco2idm, idm2vasco, schema } from 'vasco';
import Ajv from 'ajv';
import { compileScene } from '../src/compile.mjs';
import { resolveCredentials, storeCredentials, CRED_PATH } from '../src/auth.mjs';
import { renderIdm, download, getToken, listLibraries, createLibrary } from '../src/render.mjs';
import { generateImage, animateImage, narrate, generateMusic, listVoices } from '../src/ai.mjs';
import { makeZip } from '../src/zip.mjs';
import { VERSION, REPO, RAW } from '../src/version.mjs';

const args = process.argv.slice(2);

// `strata scene.json` / `strata file.idm` — a bare file arg implies the command.
const COMMANDS = ['compile', 'build', 'validate', 'inspect', 'init', 'render', 'snapshot', 'add',
    'auth', 'library', 'generate', 'schema', 'skill', 'update', 'uninstall', 'help', 'version'];
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

// Layers validate as an anyOf of every layer type, so one bad key yields a wall
// of irrelevant "required"/"additional properties" noise across all branches.
// Re-validate each layer against ITS OWN type definition to name the real culprit.
const LAYER_DEF = {
    text: 'IdmTextLayer', solid: 'IdmSolidLayer', media: 'IdmMediaLayer',
    audio: 'IdmAudioLayer', camera: 'IdmCameraLayer', composition: 'IdmCompositionLayer',
};
function friendlySchemaErrors(doc, ajv, schema) {
    const cache = {};
    const validatorFor = name => (cache[name] ??= ajv.compile({ definitions: schema.definitions, $ref: `#/definitions/${name}` }));
    const out = [];
    (doc.compositions ?? []).forEach((c, ci) => (c.layers ?? []).forEach((l, li) => {
        const def = LAYER_DEF[l.type];
        if (!def) return;
        const v = validatorFor(def);
        if (v(l)) return;
        const where = `comp ${ci} layer ${li}${l.name ? ` "${l.name}"` : ''} (${l.type})`;
        for (const e of v.errors ?? []) {
            if (e.keyword === 'additionalProperties')
                out.push(`${where}: unknown key "${e.params.additionalProperty}" — not valid on a ${l.type} layer; remove it or use a documented key`);
            else if (e.keyword === 'required')
                out.push(`${where}: missing required "${e.params.missingProperty}"`);
            else
                out.push(`${where}${e.instancePath ? ` ${e.instancePath}` : ''} ${e.message}`);
        }
    }));
    // Not a layer problem (comp-level, assets, animations, effects, masks) — fall
    // back to raw messages so nothing is hidden.
    if (!out.length) return [...new Set((ajv.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`))];
    return [...new Set(out)];
}

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
    const ajv = new Ajv({ allowUnionTypes: true, allErrors: true });
    if (!ajv.validate(schema, doc)) {
        const errs = friendlySchemaErrors(doc, ajv, schema);
        const unknownHit = errs.some(e => e.includes('unknown key'));
        if (JSON_MODE) console.error(JSON.stringify({ error: 'schema validation failed', details: errs }));
        else {
            console.error('Schema validation failed on compiled VASCO:');
            for (const e of errs) console.error('  ' + e);
            if (unknownHit) console.error('  (the VASCO schema is strict — it rejects any key it does not define. See the format reference for each layer\'s allowed keys.)');
        }
        process.exit(1);
    }
    // The compiler auto-uniquifies duplicate layer names (the exporter keys layers
    // by name globally and crashes on collisions). Tell the user what was renamed.
    if (doc.__renames?.length) {
        const shown = doc.__renames.slice(0, 8).map(([a, b]) => `"${a}"→"${b}"`).join(', ');
        const more = doc.__renames.length > 8 ? ` (+${doc.__renames.length - 8} more)` : '';
        console.error(`⚠ renamed ${doc.__renames.length} duplicate layer name(s) to keep them unique — the exporter requires unique names: ${shown}${more}`);
    }
    for (const w of layoutWarnings(scene)) console.error('⚠ ' + w);
    return { scene, doc, abs };
}

// Catch the two most common visual bugs from the scene's static boxes/timing:
// text clipped outside the frame, and two text layers overlapping while both are
// visible (unreadable). Box-based + time-window — conservative thresholds so
// entrance offsets and stacked-but-separate text don't false-positive.
function layoutWarnings(scene) {
    const out = [];
    const rect = b => (Array.isArray(b) && b.length >= 4) ? { x: b[0], y: b[1], w: b[2], h: b[3] } : null;
    const interArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
        * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const sceneDur = scene.duration ?? 4;
    const comps = [['main', { layers: scene.layers, width: scene.width, height: scene.height, duration: sceneDur }]];
    const cs = scene.comps;
    if (cs && typeof cs === 'object') for (const [n, c] of Object.entries(cs)) comps.push([n, c]);
    for (const [cn, c] of comps) {
        const cw = c?.width ?? scene.width, ch = c?.height ?? scene.height, cd = c?.duration ?? sceneDur;
        const items = (c?.layers ?? []).map(l => {
            const box = rect(l.box ?? l.bounds);
            const start = l.start ?? 0;
            return { l, box, start, end: start + (l.duration ?? Math.max(0, cd - start)) };
        }).filter(x => x.box);
        for (const { l, box } of items) {
            if (l.type !== 'text') continue;
            const outside = box.x < -1 || box.y < -1 || box.x + box.w > cw + 1 || box.y + box.h > ch + 1;
            if (outside && l.position === undefined && !(l.animate && l.animate.position))
                out.push(`comp "${cn}": text "${l.name ?? '?'}" box extends outside the ${cw}×${ch} frame — it may be clipped. Keep text inside the frame (title-safe ~90%).`);
        }
        // Overlap among "content" layers of the same kind: text↔text (unreadable)
        // and block↔block (stacked sub-comp instances). Solids/images are excluded
        // (they're usually backgrounds/frames) and text-over-block is normal layering.
        const overlapPairs = (kind, noun, fix) => {
            const g = items.filter(x => x.l.type === kind);
            for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
                const a = g[i], b = g[j];
                if (a.end <= b.start || b.end <= a.start) continue;
                const minArea = Math.min(a.box.w * a.box.h, b.box.w * b.box.h);
                if (minArea > 0 && interArea(a.box, b.box) / minArea > 0.35)
                    out.push(`comp "${cn}": ${noun} "${a.l.name ?? '?'}" and "${b.l.name ?? '?'}" overlap on screen while both visible — ${fix}`);
            }
        };
        overlapPairs('text', 'text layers', 'likely unreadable. Separate them in space or stagger their timing.');
        overlapPairs('comp', 'blocks', 'they stack on top of each other. Give each a distinct box, or stagger their timing.');
    }
    return out;
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
        fail('No Idomoo credentials. Run `strata auth login`, set IDOMOO_ACCOUNT_ID / IDOMOO_SECRET_KEY, or pass --account/--token.', 3);
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
    return `strata_${os}_${arch}${process.platform === 'win32' ? '.exe' : ''}`;
}

async function isSeaBinary() {
    try {
        const sea = await import('node:sea');
        return sea.isSea();
    } catch {
        return false;
    }
}

// ---- Agent skill (strata-cli) install/refresh -------------------------------
// The skill ships the same SKILL.md + references everywhere; only the target
// dir differs per agent. `idm-cli`/`idm-maker` are legacy names — migrate on touch.
const SKILL_NAME = 'strata-cli';
const LEGACY_SKILL_NAMES = ['idm-cli', 'idm-maker'];
const SKILL_FILES = ['SKILL.md', 'references/format.md', 'references/recipes.md',
    'references/blocks.md', 'references/blueprints.md', 'references/personalization.md'];

// Load the skill files: prefer the repo checkout (dev — instant, offline), else
// fetch the published copy from main (SEA binary has no bundled skills/).
async function loadSkillContents() {
    const scriptDir = process.argv[1] ? dirname(process.argv[1]) : '';
    const localRoots = [
        scriptDir ? join(scriptDir, '..', 'skills', SKILL_NAME) : '',
        resolve('skills', SKILL_NAME),
    ].filter(Boolean);
    const findLocal = f => localRoots.map(r => join(r, f)).find(existsSync);
    const contents = [];
    for (const f of SKILL_FILES) {
        const localPath = findLocal(f);
        if (localPath) { contents.push([f, readFileSync(localPath, 'utf8')]); continue; }
        const r = await fetch(`${RAW}/skills/${SKILL_NAME}/${f}`);
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${f}`);
        contents.push([f, await r.text()]);
    }
    return contents;
}

function writeSkillContents(destDir, contents) {
    for (const [f, text] of contents) {
        const p = join(destDir, f);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, text);
    }
}

// Remove any legacy-named copies of the skill that sit beside `destDir`.
function migrateLegacySkills(skillsBase) {
    const removed = [];
    for (const n of LEGACY_SKILL_NAMES) {
        const legacy = join(skillsBase, n);
        if (existsSync(legacy)) {
            try { rmSync(legacy, { recursive: true, force: true }); removed.push(legacy); } catch { /* ignore */ }
        }
    }
    return removed;
}

// Every agent's `skills/` parent dir. Used by `update` to refresh the skill
// wherever it's ALREADY installed (never installs to an agent that lacks it).
function agentSkillBases() {
    const home = homedir();
    return [
        { label: 'Claude Code', base: join(home, '.claude', 'skills') },
        { label: 'OpenAI Codex', base: join(home, '.codex', 'skills') },
        { label: 'Cursor', base: join(home, '.cursor', 'skills') },
        { label: 'Antigravity IDE', base: join(home, '.agents', 'skills') },
        { label: 'Antigravity CLI', base: join(home, '.gemini', 'antigravity-cli', 'skills') },
    ];
}

// Rewrite the skill in every agent dir that already has it (current OR legacy
// name), migrating legacy dirs to the current name. Returns human messages.
function refreshInstalledSkills(contents) {
    const msgs = [];
    for (const { label, base } of agentSkillBases()) {
        const present = [SKILL_NAME, ...LEGACY_SKILL_NAMES].some(n => existsSync(join(base, n)));
        if (!present) continue;
        writeSkillContents(join(base, SKILL_NAME), contents);
        msgs.push(`✅ ${label}: refreshed ${join(base, SKILL_NAME)}`);
        for (const legacy of migrateLegacySkills(base)) msgs.push(`   ↳ removed legacy ${legacy}`);
    }
    return msgs;
}

// Reuse-first block library — drop-in sub-comps. `strata add <block> scene.json`
// merges the comp (name-uniquified) + an instance stub. Mirrors references/blocks.md.
const F = './font.ttf', FB = './font-bold.ttf';
const BLOCKS = {
    'lower-third': { box: [80, 860, 760, 150], comp: { width: 760, height: 150, duration: 5, layers: [
        { type: 'solid', name: 'lt_bar', color: '#101418', box: [0, 40, 620, 92], opacity: 0.92 },
        { type: 'solid', name: 'lt_accent', color: '#4cc9f0', box: [0, 40, 8, 92] },
        { type: 'text', name: 'lt_name', text: 'Jane Cooper', font: FB, size: 40, color: '#ffffff', box: [28, 48, 580, 46], align: 'left middle' },
        { type: 'text', name: 'lt_title', text: 'Head of Design', font: F, size: 26, color: '#9aa3bf', box: [28, 92, 580, 36], align: 'left middle' } ] } },
    'stat-card': { box: [120, 200, 420, 300], comp: { width: 420, height: 300, duration: 5, layers: [
        { type: 'solid', name: 'sc_bg', color: '#0e1230', box: [0, 0, 420, 300] },
        { type: 'solid', name: 'sc_rule', color: '#ffd166', box: [40, 96, 64, 6] },
        { type: 'text', name: 'sc_value', text: '98%', font: FB, size: 120, color: '#ffffff', box: [40, 110, 340, 130], align: 'left middle' },
        { type: 'text', name: 'sc_label', text: 'Customer satisfaction', font: F, size: 28, color: '#9aa3bf', box: [40, 40, 340, 40], align: 'left middle' } ] } },
    'end-card': { box: [0, 0, 1280, 720], comp: { width: 1280, height: 720, duration: 4, layers: [
        { type: 'solid', name: 'ec_bg', color: '#0e1230', box: [0, 0, 1280, 720] },
        { type: 'text', name: 'ec_title', text: 'Acme', font: FB, size: 140, color: '#ffffff', box: [0, 240, 1280, 170], align: 'center middle' },
        { type: 'text', name: 'ec_cta', text: 'Get started today', font: F, size: 44, color: '#4cc9f0', box: [0, 430, 1280, 70], align: 'center middle' } ] } },
    'logo-sting': { box: [0, 0, 1280, 720], comp: { width: 1280, height: 720, duration: 3, layers: [
        { type: 'solid', name: 'ls_bg', color: '#ffffff', box: [0, 0, 1280, 720] },
        { type: 'image', name: 'ls_logo', src: './logo.png', box: [440, 260, 400, 200], fit: 'fit', anchor: [640, 360],
          animate: { scale: [{ t: 0, v: 0.7, ease: 'outBack' }, { t: 0.6, v: 1 }], opacity: [{ t: 0, v: 0 }, { t: 0.3, v: 1 }] } } ] } },
    'device-frame': { box: [700, 90, 520, 900], comp: { width: 520, height: 900, duration: 6, layers: [
        { type: 'solid', name: 'df_body', color: '#111418', box: [0, 0, 520, 900] },
        { type: 'solid', name: 'df_screen', color: '#000000', box: [24, 60, 472, 780] },
        { type: 'image', name: 'df_shot', src: './screen.png', box: [24, 60, 472, 780], fit: 'fill' } ] } },
    'search-bar': { box: [190, 480, 900, 96], comp: { width: 900, height: 96, duration: 6, layers: [
        { type: 'solid', name: 'sb_pill', color: '#ffffff', box: [0, 0, 900, 96], effects: [{ type: 'shadow', color: '#00000028', distance: 6, size: 20 }] },
        { type: 'text', name: 'sb_query', text: 'how do I start?', font: F, size: 42, color: '#202124', box: [40, 0, 760, 96], align: 'left middle' } ] } },
    'quote-card': { box: [140, 150, 1000, 420], comp: { width: 1000, height: 420, duration: 5, layers: [
        { type: 'solid', name: 'qc_bg', color: '#0e1230', box: [0, 0, 1000, 420] },
        { type: 'text', name: 'qc_quote', text: '"This changed how we ship."', font: FB, size: 56, color: '#ffffff', box: [60, 60, 880, 220], align: 'left top' },
        { type: 'text', name: 'qc_attr', text: '- A. Customer, Acme', font: F, size: 30, color: '#9aa3bf', box: [60, 320, 880, 44], align: 'left middle' } ] } },
};

async function main() {
    switch (cmd) {
        case 'compile':
        case 'build': {
            const scenePath = args[1];
            if (!scenePath) fail('Usage: strata compile <scene.json> [-o out.idm] [--vasco] [--json]');
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
            if (JSON_MODE) out({ ok: true, strata_path: outPath, ...summary(doc) });
            else { console.log(`✅ wrote ${outPath}`); printSummary(doc); }
            break;
        }

        case 'validate': {
            const scenePath = args[1];
            if (!scenePath) fail('Usage: strata validate <scene.json> [--print] [--json]');
            const { doc } = loadAndCompile(scenePath);
            if (flag('--print')) console.log(JSON.stringify(doc, null, 2));
            if (JSON_MODE) out({ ok: true, valid: true, ...summary(doc) });
            else { console.log('✅ scene compiles to valid VASCO'); printSummary(doc); }
            break;
        }

        case 'inspect': {
            const idmPath = args[1];
            if (!idmPath) fail('Usage: strata inspect <file.idm> [--assets <dir>]');
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

        case 'snapshot':
        case 'render': {
            const posterOnly = cmd === 'snapshot' || flag('--poster');
            const input = args[1];
            if (!input) fail(`Usage: strata render <scene.json|file.idm> --library <name-or-id> [-o out.mp4]
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
            const posterTime = Number(opt('--poster-time', '1'));
            const outPath = resolve(opt('-o', opt('--out', filename.replace(/\.idm$/i, '') + (posterOnly ? '.jpg' : '.mp4'))));

            try {
                const { videoUrl, posterUrl, libraryId } = await renderIdm({
                    idmBytes, filename,
                    accountId: creds.account_id, secret: creds.secret_key,
                    base: apiBase(), libraryName: library,
                    outHeight, quality, posterTime,
                    log: m => { if (!JSON_MODE) console.log('  ' + m); },
                });
                mkdirSync(dirname(outPath), { recursive: true });
                if (posterOnly) {
                    if (!posterUrl) fail('Render produced no poster image.', 1);
                    if (!JSON_MODE) console.log('⬇️  downloading poster...');
                    await download(posterUrl, outPath);
                    if (JSON_MODE) out({ ok: true, poster_path: outPath, poster_url: posterUrl, video_url: videoUrl, library_id: libraryId });
                    else {
                        console.log(`✅ wrote ${outPath}  (snapshot — poster only)`);
                        console.log(`   poster:  ${posterUrl}`);
                        console.log(`   library: ${libraryId}  ·  reuse with --library ${libraryId}`);
                    }
                } else {
                    if (!JSON_MODE) console.log('⬇️  downloading MP4...');
                    await download(videoUrl, outPath);
                    if (JSON_MODE) out({ ok: true, mp4_path: outPath, video_url: videoUrl, poster_url: posterUrl, library_id: libraryId });
                    else {
                        console.log(`✅ wrote ${outPath}`);
                        console.log(`   video:   ${videoUrl}`);
                        if (posterUrl) console.log(`   poster:  ${posterUrl}`);
                        console.log(`   library: ${libraryId}  ·  reuse with --library ${libraryId} so every render lands here`);
                    }
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
                if (!creds) fail(`Not authenticated. Run \`strata auth login\` or set IDOMOO_ACCOUNT_ID / IDOMOO_SECRET_KEY. (checked env, ${CRED_PATH})`, 3);
                try {
                    await getToken(apiBase(), creds.account_id, creds.secret_key);
                } catch (e) {
                    fail(`Credentials from ${creds.source} were rejected: ${e.message}`, 3);
                }
                out({ ok: true, account_id: creds.account_id, source: creds.source, base: apiBase() },
                    `✅ authenticated as account ${creds.account_id} (credentials from ${creds.source})`);
                break;
            }
            fail('Usage: strata auth login [--account <id> --token <secret>] | strata auth status');
            break;
        }

        case 'library': {
            const sub = args[1];
            if (sub !== 'list' && sub !== 'create')
                fail('Usage: strata library list [--json]  |  strata library create <name> [--json]');
            const creds = getCreds();
            const H = await bearerHeaders(creds);
            try {
                if (sub === 'list') {
                    const libs = await listLibraries(apiBase(), H);
                    if (JSON_MODE) out({ ok: true, libraries: libs });
                    else if (libs.length === 0) console.log('No libraries yet — create one with `strata library create <name>`.');
                    else for (const l of libs) console.log(`${l.id}\t${l.name}`);
                } else { // create — idempotent: reuse an existing id/name match, never duplicate
                    const name = args[2];
                    if (!name) fail('Usage: strata library create <name> [--json]');
                    const want = String(name).trim(), wantLc = want.toLowerCase();
                    const libs = await listLibraries(apiBase(), H);
                    const hit = libs.find(l => l.id === want || String(l.name).trim().toLowerCase() === wantLc);
                    const id = hit ? hit.id : await createLibrary(apiBase(), H, want);
                    if (JSON_MODE) out({ ok: true, library_id: id, name: want, reused: Boolean(hit) });
                    else console.log(`${hit ? '♻️  reusing existing' : '✅ created'} library ${id}  (${want})\n   reuse it on every render:  strata render scene.json --library ${id}`);
                }
            } catch (e) {
                fail(e.message, 3);
            }
            break;
        }

        case 'generate': {
            const sub = args[1];
            const SUBS = ['image', 'video', 'narration', 'music', 'voices'];
            if (!SUBS.includes(sub))
                fail(`Usage: strata generate <image|video|narration|music|voices> ...
  strata generate voices [--search <text>] [--json]
  strata generate image "<prompt>" [--aspect 9:16] [--colors "#a,#b"] [--reference <url>] [-o file | --out-dir dir]
  strata generate video <image-url> [--prompt "..."] [--duration 5] [--ratio 9:16] [-o file | --out-dir dir]
  strata generate narration "<text>" --voice <voice_id> [-o file | --out-dir dir]
  strata generate music "<prompt>" [--duration 30] [-o file | --out-dir dir]`);

            const creds = getCreds();
            const ctx = { accountId: creds.account_id, secret: creds.secret_key, authBase: apiBase(),
                log: m => { if (!JSON_MODE) console.log('  ' + m); } };

            // download an asset url into the chosen folder; -o overrides path,
            // else --out-dir (default ./strata_assets) + the url's basename.
            const saveAsset = async (url, fallbackName) => {
                let outPath = opt('-o', opt('--out'));
                if (!outPath) {
                    const dir = resolve(opt('--out-dir', 'strata_assets'));
                    let name = basename(new URL(url).pathname) || fallbackName;
                    if (!/\.[a-z0-9]+$/i.test(name)) name = fallbackName;
                    outPath = join(dir, name);
                }
                outPath = resolve(outPath);
                mkdirSync(dirname(outPath), { recursive: true });
                await download(url, outPath);
                return outPath;
            };

            if (sub === 'voices') {
                const search = (opt('--search') ?? '').toLowerCase();
                let voices = await listVoices(ctx);
                if (search) voices = voices.filter(v =>
                    [v.name, v.gender, v.accent, v.use_case, v.description].join(' ').toLowerCase().includes(search));
                if (JSON_MODE) out({ ok: true, voices });
                else {
                    if (!voices.length) { console.log('No voices found.'); break; }
                    for (const v of voices)
                        console.log(`${v.voice_id}\t${v.name}${v.gender ? ' · ' + v.gender : ''}${v.accent ? ' · ' + v.accent : ''}`);
                }
                break;
            }

            try {
                if (sub === 'image') {
                    const prompt = args[2];
                    if (!prompt || prompt.startsWith('-')) fail('Usage: strata generate image "<prompt>" [--aspect 9:16] ...');
                    const url = await generateImage({
                        prompt, aspect: opt('--aspect', '1:1'), colors: opt('--colors'),
                        referenceImage: opt('--reference'),
                    }, ctx);
                    const path = await saveAsset(url, 'image.png');
                    out({ ok: true, type: 'image', path, url }, `✅ saved ${path}\n   url: ${url}`);
                } else if (sub === 'video') {
                    const imageUrl = args[2];
                    if (!imageUrl || imageUrl.startsWith('-')) fail('Usage: strata generate video <image-url> [--prompt "..."] [--duration 5] ...');
                    const url = await animateImage({
                        imageUrl, prompt: opt('--prompt'),
                        duration: Number(opt('--duration', '5')), ratio: opt('--ratio'),
                    }, ctx);
                    const path = await saveAsset(url, 'video.mp4');
                    out({ ok: true, type: 'video', path, url }, `✅ saved ${path}\n   url: ${url}`);
                } else if (sub === 'narration') {
                    const text = args[2];
                    if (!text || text.startsWith('-')) fail('Usage: strata generate narration "<text>" --voice <voice_id> ...');
                    const voiceId = opt('--voice', opt('--voice-id'));
                    if (!voiceId) fail('narration needs --voice <voice_id> — list options with `strata generate voices`', 1);
                    const { url, duration } = await narrate({ text, voiceId, normalize: opt('--normalize') }, ctx);
                    const path = await saveAsset(url, 'narration.mp3');
                    out({ ok: true, type: 'narration', path, url, duration },
                        `✅ saved ${path} (${duration}s)\n   url: ${url}`);
                } else if (sub === 'music') {
                    const prompt = args[2];
                    if (!prompt || prompt.startsWith('-')) fail('Usage: strata generate music "<prompt>" [--duration 30] ...');
                    const url = await generateMusic({ prompt, duration: Number(opt('--duration', '30')) }, ctx);
                    const path = await saveAsset(url, 'music.mp3');
                    out({ ok: true, type: 'music', path, url }, `✅ saved ${path}\n   url: ${url}`);
                }
            } catch (e) {
                const msg = e?.message ?? String(e);
                fail(msg, /OAuth failed/.test(msg) ? 3 : 1);
            }
            break;
        }

        case 'schema': {
            console.log(JSON.stringify(schema, null, 2));
            break;
        }

        case 'skill': {
            if (args[1] !== 'install')
                fail('Usage: strata skill install [--claude] [--codex] [--cursor] [--antigravity] [--cowork]   (agent skill dirs, or a ZIP for Claude Cowork)');
            // Same SKILL.md format everywhere: Claude Code reads ~/.claude/skills,
            // OpenAI Codex ~/.codex/skills, Cursor ~/.cursor/skills, Google Antigravity
            // the IDE at ~/.agents/skills and the CLI at ~/.gemini/antigravity-cli/skills
            // (plus matching project dirs). Claude Cowork / claude.ai take the skill as
            // a ZIP uploaded in the app, so --cowork packages one instead.
            const home = homedir();
            const anyFlag = flag('--claude') || flag('--codex') || flag('--cursor') || flag('--antigravity') || flag('--cowork');
            const wantClaude = flag('--claude') || !anyFlag;
            const wantCodex = flag('--codex') || (!anyFlag && existsSync(join(home, '.codex')));
            const wantCursor = flag('--cursor') || (!anyFlag && existsSync(join(home, '.cursor')));
            const wantAntigravity = flag('--antigravity')
                || (!anyFlag && (existsSync(join(home, '.agents')) || existsSync(join(home, '.gemini', 'antigravity-cli'))));
            const wantCowork = flag('--cowork');
            const targets = [];
            // adds <base>/skills/<SKILL_NAME> when base exists, or always when force=true
            const addSkillDir = (base, force = false) => {
                if (force || existsSync(base)) targets.push(join(base, 'skills', SKILL_NAME));
            };
            if (wantClaude) targets.push(join(home, '.claude', 'skills', SKILL_NAME));
            if (wantCodex) targets.push(join(home, '.codex', 'skills', SKILL_NAME));
            if (wantCursor) {
                targets.push(join(home, '.cursor', 'skills', SKILL_NAME));
                const projCursor = resolve('.cursor');
                if (existsSync(projCursor) && projCursor !== join(home, '.cursor'))
                    targets.push(join(projCursor, 'skills', SKILL_NAME));
            }
            if (wantAntigravity) {
                // both products' global dirs (IDE + CLI) — user asked for ui and terminal
                targets.push(join(home, '.agents', 'skills', SKILL_NAME));                       // IDE (UI)
                targets.push(join(home, '.gemini', 'antigravity-cli', 'skills', SKILL_NAME));     // CLI (terminal)
                // project scope: .agents (IDE) and .agent (CLI) when present in the repo
                addSkillDir(resolve('.agents'));
                addSkillDir(resolve('.agent'));
            }
            const messages = [];
            try {
                const contents = await loadSkillContents();
                for (const dest of targets) {
                    writeSkillContents(dest, contents);
                    messages.push(`✅ installed ${SKILL_NAME} skill to ${dest}`);
                    for (const legacy of migrateLegacySkills(dirname(dest)))
                        messages.push(`   ↳ removed legacy ${legacy}`);
                }
                if (wantCowork) {
                    const zip = makeZip(contents.map(([f, text]) => ({
                        name: `${SKILL_NAME}/${f}`, data: Buffer.from(text, 'utf8'),
                    })));
                    const zipPath = resolve(`${SKILL_NAME}-skill.zip`);
                    writeFileSync(zipPath, zip);
                    targets.push(zipPath);
                    messages.push(`✅ packaged ${zipPath}`,
                        '   Upload it in Claude Cowork: Customize (left sidebar) → "+" → Skills tab → upload the ZIP.',
                        '   The same upload also makes the skill available in claude.ai chat.');
                }
            } catch (e) {
                fail(`Skill install failed: ${e.message}`, 2);
            }
            out({ ok: true, installed: targets }, messages.join('\n'));
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
            // Keep skills in sync with the binary: refresh the skill in every
            // agent dir that already has it (migrating any legacy idm-cli/idm-maker copy).
            // Best-effort — a skill-refresh hiccup must not fail the binary update.
            try {
                const msgs = refreshInstalledSkills(await loadSkillContents());
                if (msgs.length) { console.log('Refreshing installed skills:'); for (const m of msgs) console.log(m); }
                else console.log('No installed skills to refresh (install with: strata skill install).');
            } catch (e) {
                console.error(`⚠ skill refresh skipped: ${e.message}`);
            }
            break;
        }

        case 'uninstall': {
            // Reverse an install: remove the agent skill everywhere it's installed
            // (current + legacy names), the installed binary, and — with --purge —
            // stored credentials. PATH edits are left to the user (printed as a note).
            const purge = flag('--purge');
            const assumeYes = flag('--yes') || flag('-y') || JSON_MODE;
            const home = homedir();

            const skillDirs = [];
            for (const { base } of agentSkillBases())
                for (const n of [SKILL_NAME, ...LEGACY_SKILL_NAMES]) {
                    const d = join(base, n);
                    if (existsSync(d)) skillDirs.push(d);
                }
            const sea = await isSeaBinary();
            const exe = sea ? process.execPath : null;
            const credDirs = purge ? [join(home, '.strata'), join(home, '.idm')].filter(existsSync) : [];

            if (!skillDirs.length && !exe && !credDirs.length) {
                out({ ok: true, removed: [] }, 'Nothing to uninstall.');
                break;
            }

            if (!assumeYes && process.stdin.isTTY) {
                console.error('strata uninstall will remove:');
                for (const d of skillDirs) console.error(`  skill   ${d}`);
                if (exe) console.error(`  binary  ${exe}`);
                for (const d of credDirs) console.error(`  creds   ${d}`);
                const a = await ask('Proceed? [y/N]: ');
                if (!/^y(es)?$/i.test(a)) fail('Aborted.', 1);
            }

            const removed = [];
            const notes = [];
            for (const d of [...skillDirs, ...credDirs]) {
                try { rmSync(d, { recursive: true, force: true }); removed.push(d); }
                catch (e) { notes.push(`could not remove ${d}: ${e.message}`); }
            }
            if (exe) {
                try {
                    // Windows can't delete a running exe — rename it aside so the name
                    // frees up immediately; the .old is cleaned on next reboot/install.
                    if (process.platform === 'win32') {
                        renameSync(exe, exe + '.old');
                        try { unlinkSync(exe + '.old'); }
                        catch { notes.push(`binary is in use; it will be removed on reboot: ${exe}`); }
                    } else {
                        unlinkSync(exe);
                    }
                    removed.push(exe);
                    notes.push('if the install dir was on your PATH, remove it manually (Windows: User env PATH; Unix: your shell rc).');
                } catch (e) {
                    notes.push(`could not remove binary ${exe}: ${e.message} — delete it manually.`);
                }
            } else {
                notes.push('dev checkout — no installed binary to remove (handled skills/creds only).');
            }
            if (!purge) notes.push('credentials kept — re-run with --purge to delete ~/.strata too.');

            out({ ok: true, removed, notes }, [
                removed.length ? '✅ removed:\n' + removed.map(r => '   ' + r).join('\n') : 'Nothing removed.',
                ...notes.map(nt => '• ' + nt),
            ].join('\n'));
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
            console.log(`✅ wrote ${outPath} — point "font" at a real .ttf, then: strata compile ${args[1] ?? 'scene.json'}`);
            break;
        }

        case 'add': {
            const names = Object.keys(BLOCKS);
            if (flag('--list') || !args[1]) {
                if (JSON_MODE) out({ ok: true, blocks: names });
                else { console.log('Available blocks (strata add <block> [scene.json]):'); for (const n of names) console.log('  ' + n); }
                break;
            }
            const block = BLOCKS[args[1]];
            if (!block) fail(`Unknown block "${args[1]}". Available: ${names.join(', ')}`, 2);
            const scenePath = args.slice(2).find(a => a && !a.startsWith('-'));
            const compKey = args[1].replace(/-/g, '_');
            if (!scenePath) {
                // print the comp + an instance stub for the user to paste
                const stub = { type: 'comp', comp: compKey, name: `${compKey}_inst`, box: block.box, start: 0, duration: block.comp.duration };
                out({ comps: { [compKey]: block.comp }, instance: stub },
                    `// add to "comps":\n${JSON.stringify({ [compKey]: block.comp }, null, 2)}\n\n// add to "layers":\n${JSON.stringify({ type: 'comp', comp: compKey, name: `${compKey}_inst`, box: block.box, start: 0, duration: block.comp.duration }, null, 2)}`);
                break;
            }
            let scene;
            try { scene = JSON.parse(readFileSync(resolve(scenePath), 'utf8')); }
            catch (e) { fail(`Cannot read scene "${scenePath}": ${e.message}`, 2); }
            scene.comps = scene.comps ?? {};
            // unique comp key
            let ck = compKey, i = 2;
            while (scene.comps[ck]) ck = `${compKey}_${i++}`;
            scene.comps[ck] = JSON.parse(JSON.stringify(block.comp));
            scene.layers = scene.layers ?? [];
            // unique instance layer name across the whole scene
            const used = new Set();
            for (const arr of [scene.layers, ...Object.values(scene.comps).map(c => c?.layers ?? [])])
                for (const l of arr) if (l?.name) used.add(l.name);
            let inst = `${ck}_inst`, j = 2;
            while (used.has(inst)) inst = `${ck}_inst_${j++}`;
            // tile a repeated block beside earlier ones (wrap to next row) so blocks
            // don't stack — the agent then fine-tunes the layout.
            const cw = scene.width ?? 1920, ch = scene.height ?? 1080;
            let box = [...block.box];
            const taken = scene.layers.filter(l => l?.type === 'comp' && Array.isArray(l.box)).map(l => l.box);
            const hits = bx => taken.some(t =>
                Math.max(0, Math.min(bx[0] + bx[2], t[0] + t[2]) - Math.max(bx[0], t[0])) > 0 &&
                Math.max(0, Math.min(bx[1] + bx[3], t[1] + t[3]) - Math.max(bx[1], t[1])) > 0);
            const gap = 40;
            for (let guard = 0; hits(box) && guard < 50; guard++) {
                box[0] += box[2] + gap;
                if (box[0] + box[2] > cw) { box[0] = block.box[0]; box[1] += box[3] + gap; }
                if (box[1] + box[3] > ch) break;
            }
            scene.layers.push({ type: 'comp', comp: ck, name: inst, box, start: 0, duration: block.comp.duration,
                animate: { opacity: [{ t: 0, v: 0 }, { t: 0.4, v: 1 }] } });
            writeFileSync(resolve(scenePath), JSON.stringify(scene, null, 2));
            if (JSON_MODE) out({ ok: true, block: args[1], comp: ck, instance: inst, scene: scenePath });
            else console.log(`✅ added "${args[1]}" to ${scenePath} (comp "${ck}", instance "${inst}") — tune its box/colours/text, then compile.`);
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

strata v${VERSION} — author Idomoo IDM videos from compact scene JSON, locally

Usage:
  strata <scene.json>                                   shorthand for compile
  strata <file.idm>                                     shorthand for inspect
  strata compile  <scene.json> [-o out.idm] [--vasco]   scene -> .idm (schema-validated)
  strata validate <scene.json> [--print]                compile + schema-check, no output file
  strata inspect  <file.idm>   [--assets <dir>]         decode .idm back to vasco JSON
  strata render   <scene.json|file.idm> --library <name-or-id> [-o out.mp4]
               [--height <px>] [--quality <n>] [--base <url>]
                                                     upload to Idomoo, render, download MP4
                                                     (asks which library when run interactively)
  strata snapshot <scene.json|file.idm> --library <id>  render + download only the poster frame (.jpg)
                                                     — fast visual QA without keeping the MP4
  strata add      <block> [scene.json]                  add a reusable sub-comp block (lower-third,
                                                     stat-card, end-card, logo-sting, device-frame,
                                                     search-bar, quote-card). --list to list them
  strata library  list                                  list Idomoo libraries (id + name)
  strata library  create <name>                          create (or reuse) a library, print its id —
                                                       capture it once, then render --library <id>
                                                       every time so all videos share one library
  strata generate image|video|narration|music|voices   generate IDM assets via the Idomoo AI API
                                                     (saves files to ./strata_assets or -o; needs auth)
  strata init     [scene.json]                          write a starter scene
  strata auth     login | status                        manage Idomoo credentials (~/.strata/credentials)
  strata schema                                         print the VASCO JSON Schema
  strata skill    install [--claude] [--codex] [--cursor] [--antigravity] [--cowork]
                                                     install the strata-cli agent skill: Claude Code
                                                     (~/.claude/skills), OpenAI Codex (~/.codex/skills),
                                                     Cursor (~/.cursor/skills + project .cursor/skills),
                                                     Antigravity IDE + CLI (~/.agents/skills,
                                                     ~/.gemini/antigravity-cli/skills),
                                                     or package a ZIP to upload into Claude Cowork
  strata update                                         self-update the binary to the latest release,
                                                     then refresh the strata-cli skill in every agent
                                                     dir that already has it (claude/codex/cursor/
                                                     antigravity; migrates legacy idm-cli/idm-maker)
  strata uninstall [--purge] [--yes]                 remove the agent skill from every agent dir and
                                                     delete the installed binary (--purge also removes
                                                     ~/.strata credentials; --yes skips the prompt)
  strata version

Auth resolution: --account/--token > IDOMOO_ACCOUNT_ID/IDOMOO_SECRET_KEY env > ~/.strata/credentials
Global flags: --json (machine-readable stdout)
Exit codes: 0 ok · 1 compile/schema · 2 missing file · 3 auth · 4 render timeout`);
            process.exit(cmd && cmd !== 'help' ? 1 : 0);
    }
}

main().catch(e => fail(e?.message ?? String(e)));
