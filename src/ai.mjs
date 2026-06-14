// Idomoo Lucas AI API client — generate assets (image, video, audio) for an IDM.
//
// Auth: the bearer token is minted on the render host (same Basic account:secret
// → /oauth/token flow the CLI already uses), then sent against the AI host.
// Async endpoints return a task_id polled until status is terminal; sync ones
// return the asset URL directly.

import { getToken, download } from './render.mjs';

export const AI_BASE = 'https://api-ai.idomoo.com';
export const AUTH_BASE = 'https://usa-api.idomoo.com/api/v3';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function aiHeaders(accountId, secret, authBase = AUTH_BASE) {
    const token = await getToken(authBase, accountId, secret);
    return { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function jfetch(url, opts) {
    const r = await fetch(url, opts);
    const text = await r.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: r.status, ok: r.ok, body, text };
}

// Poll a task endpoint until status is terminal. Returns the result payload
// (the API uses either `result` or `url` for the finished asset).
async function pollTask(base, H, taskPath, { log = () => {}, timeoutMin = 20 } = {}) {
    const deadline = Date.now() + timeoutMin * 60_000;
    let last = null;
    while (Date.now() < deadline) {
        const r = await jfetch(`${base}${taskPath}`, { headers: H });
        if (r.status >= 400) throw new Error(`poll ${taskPath} → ${r.status}: ${r.text.slice(0, 200)}`);
        const status = String(r.body?.status ?? '');
        if (status !== last) { log(`status: ${status}`); last = status; }
        const s = status.toLowerCase();
        if (s === 'completed' || s === 'succeeded' || s === 'success' || s === 'done')
            return r.body.result ?? r.body.url ?? r.body;
        if (s === 'failed' || s === 'error' || r.body?.error)
            throw new Error(`task failed: ${JSON.stringify(r.body?.error ?? r.body).slice(0, 300)}`);
        await sleep(3000);
    }
    throw new Error(`task ${taskPath} timed out after ${timeoutMin} min`);
}

// Result payloads are sometimes a bare URL string, sometimes {url}/{audio_url}/[...].
export function resultUrl(result) {
    if (typeof result === 'string') return /^https?:/.test(result) ? result : null;
    if (Array.isArray(result)) return resultUrl(result[0]);
    if (result && typeof result === 'object')
        return result.url ?? result.audio_url ?? result.image_url ?? result.video_url
            ?? Object.values(result).find(v => typeof v === 'string' && /^https?:/.test(v)) ?? null;
    return null;
}

function normalizeColors(colors) {
    if (!colors) return undefined;
    return Array.isArray(colors) ? colors : String(colors).split(',').map(c => c.trim()).filter(Boolean);
}

// ---- Voices: GET /audio/voices --------------------------------------------
export async function listVoices({ accountId, secret, base = AI_BASE, authBase } = {}) {
    const H = await aiHeaders(accountId, secret, authBase);
    const r = await jfetch(`${base}/audio/voices`, { headers: H });
    if (!r.ok) throw new Error(`voices → ${r.status}: ${r.text.slice(0, 200)}`);
    const arr = Array.isArray(r.body) ? r.body : r.body?.voices ?? [];
    return arr.map(v => ({
        voice_id: v.voice_id ?? v.id,
        name: v.name ?? '',
        gender: v.labels?.gender ?? '',
        accent: v.labels?.accent ?? '',
        use_case: v.labels?.use_case ?? '',
        description: v.description ?? '',
    }));
}

// ---- Image: POST /images/generate-image (Gemini, async) -------------------
export async function generateImage({ prompt, aspect = '1:1', colors, images, referenceImage },
    { accountId, secret, base = AI_BASE, authBase, log = () => {} }) {
    const H = await aiHeaders(accountId, secret, authBase);
    const payload = { prompt, aspect_ratio: aspect };
    const c = normalizeColors(colors);
    if (c) payload.colors = c;
    if (images) payload.images = Array.isArray(images) ? images : [images];
    if (referenceImage) payload.reference_image = referenceImage;

    log('Submitting image generation...');
    const r = await jfetch(`${base}/images/generate-image`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
    if (!r.ok || !r.body?.task_id) throw new Error(`generate-image → ${r.status}: ${r.text.slice(0, 300)}`);
    log(`task ${r.body.task_id}`);
    const url = resultUrl(await pollTask(base, H, `/images/generate-image/${r.body.task_id}`, { log }));
    if (!url) throw new Error('no image url in result');
    return url;
}

// ---- Video: POST /images/animate (image-to-video, async) ------------------
export async function animateImage({ imageUrl, prompt, duration = 5, ratio, modelId },
    { accountId, secret, base = AI_BASE, authBase, log = () => {} }) {
    if (!imageUrl) throw new Error('animate needs an image URL (image_url)');
    const H = await aiHeaders(accountId, secret, authBase);
    const payload = { image_url: imageUrl };
    if (prompt) payload.prompt = prompt;
    if (duration) payload.duration = duration;
    if (ratio) payload.ratio = ratio;
    if (modelId) payload.model_id = modelId;

    log('Submitting image-to-video...');
    const r = await jfetch(`${base}/images/animate`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
    if ((r.status !== 200 && r.status !== 202) || !r.body?.task_id)
        throw new Error(`animate → ${r.status}: ${r.text.slice(0, 300)}`);
    log(`task ${r.body.task_id}`);
    const url = resultUrl(await pollTask(base, H, `/images/animate/${r.body.task_id}`, { log }));
    if (!url) throw new Error('no video url in result');
    return url;
}

// ---- Audio (TTS): POST /audio/narrate (sync) ------------------------------
export async function narrate({ text, voiceId, modelId, normalize },
    { accountId, secret, base = AI_BASE, authBase, log = () => {} }) {
    if (!voiceId) throw new Error('narrate needs a voice_id (see `idm generate voices`)');
    const H = await aiHeaders(accountId, secret, authBase);
    const payload = { text, voice_id: voiceId };
    if (modelId) payload.model_id = modelId;
    if (normalize) payload.apply_text_normalization = normalize;

    log('Generating narration...');
    const r = await jfetch(`${base}/audio/narrate`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
    if (!r.ok || !r.body?.audio_url) throw new Error(`narrate → ${r.status}: ${r.text.slice(0, 300)}`);
    return { url: r.body.audio_url, duration: r.body.duration };
}

// ---- Music: POST /music/generate ------------------------------------------
export async function generateMusic({ prompt, duration = 30 },
    { accountId, secret, base = AI_BASE, authBase, log = () => {} }) {
    const H = await aiHeaders(accountId, secret, authBase);
    log('Generating soundtrack...');
    const r = await jfetch(`${base}/music/generate`, { method: 'POST', headers: H, body: JSON.stringify({ prompt, duration }) });
    if (!r.ok) throw new Error(`music/generate → ${r.status}: ${r.text.slice(0, 300)}`);
    // direct url, or a song id to fetch via GET /music/{song_id}
    let url = resultUrl(r.body);
    const songId = r.body?.song_id ?? r.body?.id ?? r.body?.data?.song_id ?? r.body?.data?.id;
    if (!url && songId) {
        const g = await jfetch(`${base}/music/${songId}`, { headers: H });
        if (!g.ok) throw new Error(`music/${songId} → ${g.status}: ${g.text.slice(0, 200)}`);
        url = resultUrl(g.body?.data ?? g.body);
    }
    if (!url) throw new Error(`no music url in response: ${JSON.stringify(r.body).slice(0, 200)}`);
    return url;
}

export { download };
