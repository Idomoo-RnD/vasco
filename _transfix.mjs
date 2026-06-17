import { vasco2idm } from 'vasco';
import fs from 'fs';
const doc = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const mode = process.argv[4] || 'all';
for (const c of doc.compositions||[]) {
  if (c.transition === undefined) c.transition = { start:0, end:0 };
  if (mode === 'all') { if (c.shutter_angle===undefined) c.shutter_angle=0.5; if (c.shutter_phase===undefined) c.shutter_phase=-0.25; }
}
vasco2idm(doc, process.argv[3]);
console.log('wrote', process.argv[3], 'mode=', mode);
