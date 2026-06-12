// Smoke test: compile both examples through the real pipeline, encode to .idm,
// decode back with idm2vasco, and assert the round-trip. No network needed.
import { readFileSync, mkdirSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { vasco2idm, idm2vasco, schema } from 'vasco';
import Ajv from 'ajv';
import { compileScene } from '../src/compile.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, 'test', '.out');
mkdirSync(tmp, { recursive: true });

let failures = 0;
function check(label, cond) {
    if (cond) console.log(`  ok  ${label}`);
    else { console.error(`FAIL  ${label}`); failures++; }
}

const ajv = new Ajv({ allowUnionTypes: true });

for (const name of ['demo', 'kitchen_sink']) {
    console.log(`\n[${name}]`);
    const scenePath = join(root, 'examples', `${name}.json`);
    const scene = JSON.parse(readFileSync(scenePath, 'utf8'));
    const doc = compileScene(scene, dirname(scenePath));

    check('schema-valid', ajv.validate(schema, doc));

    const idmPath = join(tmp, `${name}.idm`);
    vasco2idm(doc, idmPath);
    const buf = readFileSync(idmPath);
    check('idm written', buf.length > 1000);

    const assets = new Map();
    const back = idm2vasco(new DataView(buf.buffer, buf.byteOffset, buf.byteLength), assets);
    const comp = back.compositions[back.entry_point];
    const src = doc.compositions[doc.entry_point];
    check('comp size round-trips', comp.width === src.width && comp.height === src.height);
    check('layer count round-trips', comp.layers.length === src.layers.length);
    check('animations round-trip', back.animations.length === doc.animations.length);
    check('assets embedded', assets.size === doc.assets.length);
}

// tween engine specifics on the demo
{
    const scenePath = join(root, 'examples', 'demo.json');
    const doc = compileScene(JSON.parse(readFileSync(scenePath, 'utf8')), dirname(scenePath));
    const comp = doc.compositions[doc.entry_point];
    const title = comp.layers.find(l => l.name === 'title');
    const op = doc.animations[title.animations.opacity].frames;
    console.log('\n[tween engine]');
    check('opacity baked over layer frames', op.length === title.num_of_frames);
    check('outCubic ease applied', Math.abs(op[1] - (1 - (1 - 1 / 20) ** 3)) < 1e-6);
    const tf = doc.animations[title.animations.transform].frames;
    check('outBack overshoot present', tf.some(m => m[13] < -0.01));
}

rmSync(tmp, { recursive: true, force: true });
if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
}
console.log('\nall checks passed');
