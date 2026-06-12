// Upload an .idm to Idomoo and render it to an MP4.
// Flow (mirrors the production render_scene tool):
//   1. POST /oauth/token  (Basic account_id:secret_key)  -> bearer token
//   2. get-or-create a library
//   3. POST /scenes?library=&filename=  -> { ref, url }; PUT the .idm bytes to url
//   4. poll GET /scenes/{id} until the exporter fills in the scene JSON
//   5. POST /scenes/generate with the scene JSON  -> check_status_url + output urls
//   6. poll until VIDEO_AVAILABLE, download the MP4

const DEFAULT_BASE = 'https://usa-api.idomoo.com/api/v3';
const EXPORT_ATTEMPTS = 3;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function jfetch(url, opts = {}) {
    const r = await fetch(url, opts);
    let body = null;
    const text = await r.text();
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: r.status, ok: r.ok, body, text };
}

export async function getToken(base, accountId, secret) {
    const r = await jfetch(`${base}/oauth/token`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + Buffer.from(`${accountId}:${secret}`).toString('base64'),
        },
    });
    if (!r.ok || !r.body?.access_token)
        throw new Error(`OAuth failed (${r.status}): ${r.text.slice(0, 300)}`);
    return r.body.access_token;
}

const libId = it => String(it.id ?? it.library_id ?? String(it.ref ?? '').replace(/\/+$/, '').split('/').pop());
const libName = it => it.name ?? it.library_name ?? '';

export async function listLibraries(base, H) {
    const list = await jfetch(`${base}/libraries`, { headers: H });
    const items = Array.isArray(list.body) ? list.body
        : list.body?.libraries ?? list.body?.data ?? [];
    return items.map(it => ({ id: libId(it), name: libName(it) }));
}

export async function createLibrary(base, H, name) {
    const made = await jfetch(`${base}/libraries`, {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (made.status >= 300)
        throw new Error(`Cannot create library "${name}" (${made.status}): ${made.text.slice(0, 200)}`);
    return libId(made.body ?? {});
}

// Accepts a library name or id; creates the library when no existing one matches.
async function getOrCreateLibrary(base, H, nameOrId) {
    const libs = await listLibraries(base, H);
    for (const it of libs)
        if (it.name === String(nameOrId) || it.id === String(nameOrId)) return it.id;
    return createLibrary(base, H, String(nameOrId));
}

async function uploadAndExport(base, H, libraryId, filename, idmBytes, log) {
    let lastErr = null;
    for (let attempt = 1; attempt <= EXPORT_ATTEMPTS; attempt++) {
        log(attempt === 1 ? 'Uploading scene to Idomoo...'
            : `Exporter hiccup — retrying (${attempt}/${EXPORT_ATTEMPTS})...`);
        const created = await jfetch(`${base}/scenes?library=${encodeURIComponent(libraryId)}&filename=${encodeURIComponent(filename)}`,
            { method: 'POST', headers: H });
        if (created.status !== 200 && created.status !== 201)
            throw new Error(`Create scene failed (${created.status}): ${created.text.slice(0, 300)}`);
        const sceneId = String(created.body.ref).replace(/\/+$/, '').split('/').pop();
        const put = await fetch(created.body.url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: idmBytes,
        });
        if (put.status !== 200 && put.status !== 204)
            throw new Error(`.idm upload failed (${put.status})`);
        log('Processing scene...');
        let exportErr = null;
        for (let poll = 0; poll < 60; poll++) {
            const g = await jfetch(`${base}/scenes/${sceneId}`, { headers: H });
            const sj = g.status === 200 && typeof g.body === 'object' ? g.body : {};
            const st = String(sj.scene_status ?? '');
            // empty errors array means "no errors" (unlike Python, [] is truthy in JS)
            const hasErrors = Array.isArray(sj.errors) ? sj.errors.length > 0 : Boolean(sj.errors);
            if (st.toLowerCase() === 'error' || hasErrors) { exportErr = sj.errors ?? st; break; }
            // wait for the terminal "Done" state — generate 404s on a half-exported scene
            if (String(sj.scene_status).toLowerCase() === 'done') return { sceneJson: sj, sceneId };
            await sleep(2000);
        }
        lastErr = exportErr ?? `scene ${sceneId} timed out exporting`;
        if (attempt < EXPORT_ATTEMPTS) await sleep(Math.min(5000 * attempt, 20000));
    }
    throw new Error(`Scene export failed after ${EXPORT_ATTEMPTS} attempts. Last error: ${JSON.stringify(lastErr).slice(0, 300)}`);
}

// The generate schema wants a MINIMAL scene object: scene_id + the placeholder
// data arrays. Extra export metadata (owner, identifiers, video, timestamps...)
// makes the API reject the request, so whitelist instead of blacklisting.
// Per-element `placeholder` booleans are export-info the schema rejects too.
function cleanSceneJson(sceneJson, sceneId) {
    const clean = arr => (arr ?? []).map(el => {
        if (el && typeof el === 'object') { const e = { ...el }; delete e.placeholder; return e; }
        return el;
    });
    return {
        scene_id: sceneJson.scene_id ?? (Number(sceneId) || sceneId),
        media: clean(sceneJson.media),
        text: clean(sceneJson.text),
        audio: clean(sceneJson.audio),
    };
}

async function startRender(base, H, sceneJson, sceneId, outHeight, quality, log) {
    let scene = cleanSceneJson(sceneJson, sceneId);
    for (let attempt = 0; attempt < 6; attempt++) {
        const body = {
            timeline: { scene_order: 'linear', scenes: [scene] },
            output: {
                video: [{ format: 'mp4', quality, height: outHeight }],
                jpg: [{ height: outHeight, time: 1 }],
            },
        };
        const r = await jfetch(`${base}/scenes/generate`, {
            method: 'POST',
            headers: { ...H, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (r.status === 202) return r.body;
        // schema rejection: strip the unknown property it names and retry
        if (r.status >= 400 && r.status < 500) {
            const mentioned = Object.keys(scene).filter(k => r.text.includes(`"${k}"`) || r.text.includes(`'${k}'`));
            const strippable = mentioned.filter(k => !['media', 'text', 'audio', 'scene_id'].includes(k));
            if (strippable.length > 0) {
                log(`Generate rejected key(s) ${strippable.join(', ')} — stripping and retrying...`);
                for (const k of strippable) delete scene[k];
                continue;
            }
        }
        throw new Error(`Start render failed (${r.status}): ${r.text.slice(0, 400)}`);
    }
    throw new Error('Start render failed: schema retries exhausted');
}

export async function renderIdm({ idmBytes, filename, accountId, secret, base = DEFAULT_BASE,
    libraryName, outHeight, quality = 26, log = () => {} }) {
    if (!libraryName) throw new Error('libraryName is required — pick one with `idm library list` or name a new one');
    log('Authenticating with Idomoo...');
    const token = await getToken(base, accountId, secret);
    const H = { Accept: 'application/json', Authorization: `Bearer ${token}` };

    const libraryId = await getOrCreateLibrary(base, H, libraryName);
    const { sceneJson, sceneId } = await uploadAndExport(base, H, libraryId, filename, idmBytes, log);

    log('Starting render...');
    const init = await startRender(base, H, sceneJson, sceneId, outHeight, quality, log);
    const out = init.output ?? {};
    const videoUrl = (out.video ?? []).map(v => v?.links?.url).find(Boolean) ?? null;
    const posterUrl = (out.jpg ?? []).map(j => j?.links?.url).find(Boolean) ?? null;
    const checkUrl = init.check_status_url;
    if (!checkUrl) throw new Error(`Render accepted but no check_status_url: ${JSON.stringify(init).slice(0, 300)}`);

    let last = null;
    for (let i = 0; i < 90; i++) {
        await sleep(8000);
        const s = await jfetch(checkUrl, { headers: { Accept: 'application/json' } });
        const status = s.status === 200 ? (s.body?.status ?? '') : `HTTP${s.status}`;
        if (status !== last) { log(`Render status: ${status} (~${(i + 1) * 8}s)`); last = status; }
        if (status === 'VIDEO_AVAILABLE') return { videoUrl, posterUrl };
        if (status === 'FAILED' || status === 'ERROR')
            throw new Error(`Render failed with status ${status}: ${s.text.slice(0, 300)}`);
    }
    throw new Error(`Render timed out after ~12 min (last status ${last}). Video URL was ${videoUrl}`);
}

export async function download(url, destPath) {
    const { writeFileSync } = await import('fs');
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Download failed (${r.status}) from ${url}`);
    writeFileSync(destPath, Buffer.from(await r.arrayBuffer()));
}
