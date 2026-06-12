// Tween engine: bakes keyframes [{t|f, v, ease}] into per-frame value arrays
// (VASCO IdmFrameAnimation.frames). `t` is seconds, `f` is frames — both relative
// to the layer's first frame. `ease` shapes the segment leaving that keyframe.

import { getEase } from './easing.mjs';

export function normalizeKeyframes(kfs, fps, mapV = v => v) {
    if (!Array.isArray(kfs) || kfs.length === 0)
        throw new Error('Keyframes must be a non-empty array of {t|f, v, ease?}');
    return kfs.map((k, i) => {
        if (k == null || typeof k !== 'object' || k.v === undefined)
            throw new Error(`Keyframe ${i} must be an object with a "v" value`);
        const frame = k.f !== undefined ? k.f : (k.t ?? 0) * fps;
        return { frame, v: mapV(k.v), ease: k.ease != null ? getEase(k.ease) : null };
    }).sort((a, b) => a.frame - b.frame);
}

export function sampleKeyframes(kfs, frame) {
    if (frame <= kfs[0].frame) return kfs[0].v;
    const last = kfs[kfs.length - 1];
    if (frame >= last.frame) return last.v;
    for (let j = 0; j < kfs.length - 1; j++) {
        const a = kfs[j], b = kfs[j + 1];
        if (frame >= a.frame && frame < b.frame) {
            const u = (frame - a.frame) / (b.frame - a.frame);
            // ease of the outgoing keyframe wins; fall back to the incoming one
            const ease = a.ease ?? b.ease ?? (x => x);
            return lerpValue(a.v, b.v, ease(u));
        }
    }
    return last.v;
}

export function bake(kfs, fps, numFrames, mapV = v => v) {
    const norm = normalizeKeyframes(kfs, fps, mapV);
    const out = new Array(numFrames);
    for (let i = 0; i < numFrames; i++) out[i] = sampleKeyframes(norm, i);
    return out;
}

export function lerpValue(a, b, t) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length)
        return a.map((x, i) => lerpValue(x, b[i], t));
    // vector-graphics command {type, values}
    if (a && b && typeof a === 'object' && typeof b === 'object' &&
        a.type === b.type && Array.isArray(a.values) && Array.isArray(b.values))
        return { type: a.type, values: lerpValue(a.values, b.values, t) };
    // non-interpolable (bool, string, mismatched shapes): hold until segment end
    return t < 1 ? a : b;
}
