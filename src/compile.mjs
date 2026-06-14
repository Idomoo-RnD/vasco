// Compiles compact scene JSON into a full VASCO IdmProject.
// Sugar is translated (tweens baked, transforms composed, assets deduped,
// inline effects/masks hoisted); any other key passes through verbatim,
// so the entire VASCO surface stays reachable.

import { resolve, extname } from 'path';
import { existsSync } from 'fs';
import { bake, normalizeKeyframes, sampleKeyframes } from './tween.mjs';
import { composeTransform } from './transform.mjs';

const EXT_TYPE = {
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image',
    '.bmp': 'image', '.gif': 'image', '.tif': 'image', '.tiff': 'image',
    '.mp4': 'video', '.mov': 'video', '.avi': 'video', '.webm': 'video',
    '.mkv': 'video', '.m4v': 'video',
    '.mp3': 'audio', '.wav': 'audio', '.aac': 'audio', '.m4a': 'audio',
    '.ogg': 'audio', '.flac': 'audio',
    '.ttf': 'font', '.otf': 'font', '.ttc': 'font',
};

const TYPE_MAP = {
    image: 'media', video: 'media', media: 'media',
    text: 'text', solid: 'solid', audio: 'audio',
    camera: 'camera', comp: 'composition', composition: 'composition',
};

// ---------------------------------------------------------------- helpers

export function hexToColor(hex, len = 3) {
    let h = hex.replace(/^#/, '');
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8)
        throw new Error(`Bad color ${JSON.stringify(hex)} — use #rgb, #rrggbb or #rrggbbaa`);
    const n = parseInt(h, 16);
    const bytes = h.length === 8
        ? [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
        : [(n >>> 16) & 255, (n >>> 8) & 255, n & 255, 255];
    const c = bytes.map(b => Math.round(b / 255 * 10000) / 10000);
    return len === 4 ? c : c.slice(0, 3);
}

function color(v, len = 3) {
    return typeof v === 'string' ? hexToColor(v, len) : v;
}

function parseAlign(a) {
    if (a == null) return undefined;
    if (typeof a === 'object')
        return { horizontal: a.h ?? a.horizontal ?? 'left', vertical: a.v ?? a.vertical ?? 'top' };
    const words = String(a).toLowerCase().split(/[\s,]+/);
    const out = { horizontal: 'left', vertical: 'top' };
    for (const w of words) {
        if (['left', 'center', 'right'].includes(w)) out.horizontal = w;
        if (['top', 'middle', 'baseline', 'bottom'].includes(w)) out.vertical = w;
    }
    return out;
}

function parseBounds(b, comp) {
    if (Array.isArray(b)) return { x: b[0], y: b[1], width: b[2], height: b[3] };
    if (b && typeof b === 'object') return { x: b.x ?? 0, y: b.y ?? 0, width: b.width ?? b.w, height: b.height ?? b.h };
    return { x: 0, y: 0, width: comp.width, height: comp.height };
}

function vec3of(v, fill = 0) {
    if (typeof v === 'number') return [v, v, fill];
    return [v[0] ?? fill, v[1] ?? fill, v[2] ?? fill];
}

// ---------------------------------------------------------------- shapes

const KAPPA = 0.5522847498307936;

export function shapeCommands(s) {
    if (Array.isArray(s)) return s; // raw vasco commands
    if (s.shape) return s.shape;
    if (s.rect) {
        const [x, y, w, h] = s.rect;
        return [
            { type: 'move_to', values: [x, y] },
            { type: 'line_to', values: [x + w, y] },
            { type: 'line_to', values: [x + w, y + h] },
            { type: 'line_to', values: [x, y + h] },
            { type: 'line_to', values: [x, y] },
        ];
    }
    if (s.ellipse) {
        const [cx, cy, rx, ry] = s.ellipse;
        const kx = rx * KAPPA, ky = ry * KAPPA;
        return [
            { type: 'move_to', values: [cx + rx, cy] },
            { type: 'cubic_to', values: [cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry] },
            { type: 'cubic_to', values: [cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy] },
            { type: 'cubic_to', values: [cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry] },
            { type: 'cubic_to', values: [cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy] },
        ];
    }
    if (s.path) {
        if (s.path.length && typeof s.path[0] === 'object' && !Array.isArray(s.path[0]))
            return s.path; // raw command objects
        const pts = s.path;
        const cmds = [{ type: 'move_to', values: [...pts[0]] }];
        for (let i = 1; i < pts.length; i++) cmds.push({ type: 'line_to', values: [...pts[i]] });
        if (s.closed !== false) cmds.push({ type: 'line_to', values: [...pts[0]] });
        return cmds;
    }
    throw new Error(`Mask shape needs one of rect / ellipse / path / shape — got keys [${Object.keys(s)}]`);
}

// ---------------------------------------------------------------- compiler

class Compiler {
    constructor(scene, sceneDir) {
        this.scene = scene;
        this.sceneDir = sceneDir;
        this.doc = { entry_point: 0, compositions: [], assets: [], masks: [], animations: [], effects: [] };
        this.assetIds = new Map();
        this.compIds = new Map();
        this.fps = scene.fps ?? 25;
    }

    compile() {
        // The IDM encoder requires a composition to be written before any layer
        // that references it — so sub-comps go first, the main comp last.
        const subs = this.scene.comps ?? {};
        Object.keys(subs).forEach((name, i) => this.compIds.set(name, i));
        for (const [name, def] of Object.entries(subs))
            this.doc.compositions.push(this.comp(def, name));
        this.doc.compositions.push(this.comp(this.scene, this.scene.name ?? 'main'));
        this.doc.entry_point = this.doc.compositions.length - 1;
        return this.doc;
    }

    assetId(uri, typeHint) {
        const abs = resolve(this.sceneDir, uri);
        if (!existsSync(abs)) throw new Error(`Asset not found: "${uri}" (resolved to ${abs})`);
        const type = typeHint ?? EXT_TYPE[extname(uri).toLowerCase()];
        if (!type) throw new Error(`Cannot infer asset type of "${uri}" — unknown extension`);
        const key = type + '|' + abs;
        if (!this.assetIds.has(key)) {
            this.assetIds.set(key, this.doc.assets.length);
            this.doc.assets.push({ type, uri: abs });
        }
        return this.assetIds.get(key);
    }

    addAnimation(frames) {
        this.doc.animations.push({ frames });
        return this.doc.animations.length - 1;
    }

    comp(def, name) {
        const fps = def.fps ?? this.fps;
        const numFrames = def.num_of_frames ?? Math.max(1, Math.round((def.duration ?? 4) * fps));
        const comp = {
            name: def.name ?? name,
            width: def.width ?? 1280,
            height: def.height ?? 720,
            num_of_frames: numFrames,
            fps,
            layers: [],
        };
        for (const k of ['shutter_angle', 'shutter_phase', 'transition'])
            if (def[k] !== undefined) comp[k] = def[k];

        const layers = def.layers ?? [];
        comp.layers = layers.map(l => this.layer(l, comp, fps));

        // resolve track-matte sources by layer name -> index
        comp.layers.forEach(l => {
            if (l.__matteSource !== undefined) {
                const idx = comp.layers.findIndex(o => o.name === l.__matteSource);
                if (idx < 0) throw new Error(`matte source layer "${l.__matteSource}" not found in comp "${comp.name}"`);
                l.track_matte_source_id = idx;
                delete l.__matteSource;
            }
        });
        return comp;
    }

    layer(l, comp, fps) {
        const type = TYPE_MAP[l.type];
        if (!type) throw new Error(`Unknown layer type "${l.type}" (use text, image, video, media, solid, audio, comp, camera)`);
        const out = { type };
        if (l.name) out.name = l.name;

        // ----- timing
        const first = l.first_frame ?? Math.round((l.start ?? 0) * fps);
        const n = l.num_of_frames ?? (l.duration != null
            ? Math.max(1, Math.round(l.duration * fps))
            : Math.max(1, comp.num_of_frames - first));
        out.first_frame = first;
        out.num_of_frames = n;

        const isVisual = ['text', 'solid', 'media', 'composition'].includes(type);
        const handled = new Set(['type', 'name', 'start', 'duration', 'first_frame', 'num_of_frames',
            'position', 'scale', 'rotation', 'anchor', 'animate', 'effects', 'mask', 'matte']);

        // Motion blur is ON by default for every visual layer (set
        // motion_blur:false to opt out). Camera layers are excluded — their
        // motion_blur only passes through when set explicitly.
        if (isVisual) {
            out.motion_blur = l.motion_blur ?? true;
            handled.add('motion_blur');
        }

        if (isVisual) {
            out.bounds = parseBounds(l.box ?? l.bounds, comp);
            handled.add('box').add('bounds');
            if (l.opacity !== undefined) { out.opacity = l.opacity; handled.add('opacity'); }
            if (l.blend !== undefined) { out.blend_mode = l.blend; handled.add('blend'); }
            if (l.fit !== undefined) {
                out.alignment = typeof l.fit === 'string' ? { scale_type: l.fit } : l.fit;
                handled.add('fit');
            }
        }

        // ----- type specifics
        if (type === 'media') {
            if (!l.src) throw new Error(`Layer "${l.name ?? '?'}" (${l.type}) needs "src"`);
            const hint = l.type === 'image' ? 'image' : l.type === 'video' ? 'video' : undefined;
            out.asset_id = this.assetId(l.src, hint);
            handled.add('src');
            if (l.loop !== undefined) { out.playback_mode = l.loop ? 'loop' : 'cut'; handled.add('loop'); }
        }
        if (type === 'audio') {
            if (!l.src) throw new Error(`Audio layer "${l.name ?? '?'}" needs "src"`);
            out.asset_id = this.assetId(l.src, 'audio');
            handled.add('src');
            if (l.volume !== undefined) { out.volume = l.volume; handled.add('volume'); }
            if (l.ducking !== undefined) { out.sidechain_compression = l.ducking; handled.add('ducking'); }
        }
        if (type === 'text') {
            if (!l.font) throw new Error(`Text layer "${l.name ?? '?'}" needs "font" (path to .ttf/.otf)`);
            out.font_id = this.assetId(l.font, 'font');
            handled.add('font');
            if (l.text !== undefined) { out.text = l.text; handled.add('text'); }
            if (l.size !== undefined) { out.font_size = l.size; handled.add('size'); }
            if (l.min_size !== undefined) { out.min_font_size = l.min_size; handled.add('min_size'); }
            if (l.align !== undefined) { out.alignment = parseAlign(l.align); handled.add('align'); }
            if (l.color !== undefined) { out.color = color(l.color, 3); handled.add('color'); }
            if (l.styles !== undefined) {
                out.styles = l.styles.map(s => {
                    const st = { ...s };
                    if (st.font) { st.font_id = this.assetId(st.font, 'font'); delete st.font; }
                    else if (st.font_id === undefined) st.font_id = out.font_id;
                    if (st.size !== undefined) { st.font_size = st.size; delete st.size; }
                    if (st.color !== undefined) st.color = color(st.color, 3);
                    if (typeof st.highlight === 'string') st.highlight = hexToColor(st.highlight, 4);
                    return st;
                });
                handled.add('styles');
            }
            if (l.animators !== undefined) {
                out.animators = l.animators.map(a => this.textAnimator(a, fps, n));
                handled.add('animators');
            }
        }
        if (type === 'solid' && l.color !== undefined) {
            out.color = color(l.color, 3);
            handled.add('color');
        }
        if (type === 'composition') {
            const ref = l.comp ?? l.comp_id;
            const id = typeof ref === 'string' ? this.compIds.get(ref) : ref;
            if (id === undefined) throw new Error(`Unknown comp reference "${ref}" — define it under "comps"`);
            out.comp_id = id;
            handled.add('comp').add('comp_id');
        }
        if (type === 'camera' && l.fov !== undefined) {
            out.field_of_view = l.fov;
            handled.add('fov');
        }
        // ----- animation channels
        const anim = l.animate ?? {};
        const animIds = {};

        const TRANSFORM_CHANNELS = ['position', 'scale', 'rotation', 'anchor'];
        const tweens = TRANSFORM_CHANNELS.filter(c => anim[c]);
        if (tweens.length > 0) {
            const tracks = {};
            for (const c of TRANSFORM_CHANNELS)
                if (anim[c]) tracks[c] = normalizeKeyframes(anim[c], fps);
            const frames = [];
            for (let i = 0; i < n; i++) {
                frames.push(composeTransform(
                    tracks.position ? sampleKeyframes(tracks.position, i) : l.position,
                    tracks.scale ? sampleKeyframes(tracks.scale, i) : l.scale,
                    tracks.rotation ? sampleKeyframes(tracks.rotation, i) : l.rotation,
                    tracks.anchor ? sampleKeyframes(tracks.anchor, i) : l.anchor,
                ));
            }
            animIds.transform = this.addAnimation(frames);
            out.transform = frames[0];
        } else if (l.position != null || l.scale != null || l.rotation != null || l.anchor != null) {
            out.transform = composeTransform(l.position, l.scale, l.rotation, l.anchor);
        }

        for (const [ch, kfs] of Object.entries(anim)) {
            if (TRANSFORM_CHANNELS.includes(ch)) continue;
            let channel = ch, mapV = v => v;
            if (ch === 'color') mapV = v => color(v, 3);
            animIds[channel] = this.addAnimation(bake(kfs, fps, n, mapV));
        }
        if (Object.keys(animIds).length > 0) out.animations = { ...animIds, ...(l.animations ?? {}) };
        handled.add('animations');
        if (l.animations && !out.animations) out.animations = l.animations;

        // ----- mask / matte / effects
        if (l.mask !== undefined) out.mask_id = this.mask(l.mask, fps, n);
        if (l.matte !== undefined) {
            out.track_matte = l.matte.type ?? 'alpha';
            out.__matteSource = l.matte.source;
        }
        if (l.effects !== undefined) out.effect_ids = this.effects(l.effects, fps, n);

        // ----- passthrough for everything else (full VASCO surface)
        for (const [k, v] of Object.entries(l))
            if (!handled.has(k) && out[k] === undefined) out[k] = v;

        return out;
    }

    // text animators / ranges: passthrough + animate support + hex colors
    textAnimator(a, fps, n) {
        const out = { ...a };
        if (out.color !== undefined) out.color = color(out.color, 4);
        if (out.ranges) out.ranges = out.ranges.map(r => this.animatable({ ...r }, fps, n));
        return this.animatable(out, fps, n);
    }

    // generic: compile an object's `animate` block into doc animations
    animatable(obj, fps, n, channelMap = {}, valueMaps = {}) {
        if (!obj.animate) return obj;
        const ids = {};
        for (const [ch, kfs] of Object.entries(obj.animate)) {
            const channel = channelMap[ch] ?? ch;
            const mapV = valueMaps[ch] ?? (v => v);
            ids[channel] = this.addAnimation(bake(kfs, fps, n, mapV));
        }
        delete obj.animate;
        obj.animations = { ...(obj.animations ?? {}), ...ids };
        return obj;
    }

    mask(m, fps, n) {
        const shapes = Array.isArray(m) ? m : (m.shapes ?? [m]);
        const compiled = shapes.map(s => {
            const out = { shape: shapeCommands(s) };
            if (s.feather !== undefined) out.feather = typeof s.feather === 'number' ? [s.feather, s.feather] : s.feather;
            for (const k of ['inverted', 'opacity', 'expansion'])
                if (s[k] !== undefined) out[k] = s[k];
            if (s.blend !== undefined) out.blend_mode = s.blend;
            if (s.blend_mode !== undefined) out.blend_mode = s.blend_mode;
            if (s.animate) {
                out.animate = s.animate;
                this.animatable(out, fps, n, {}, {
                    shape: v => shapeCommands(typeof v === 'object' && !Array.isArray(v) ? v : { shape: v }),
                    feather: v => typeof v === 'number' ? [v, v] : v,
                });
            }
            return out;
        });
        this.doc.masks.push({ shapes: compiled });
        return this.doc.masks.length - 1;
    }

    effects(list, fps, n) {
        const ids = [];
        let styles = null;
        const styleId = () => {
            if (!styles) {
                styles = { name: 'styles' };
                this.doc.effects.push(styles);
                ids.push(this.doc.effects.length - 1);
            }
            return styles;
        };
        const pins = p => {
            if (Array.isArray(p)) {
                const [ul, ur, ll, lr] = p;
                return { upper_left: ul, upper_right: ur, lower_left: ll, lower_right: lr };
            }
            return {
                upper_left: p.ul ?? p.upper_left, upper_right: p.ur ?? p.upper_right,
                lower_left: p.ll ?? p.lower_left, lower_right: p.lr ?? p.lower_right,
            };
        };

        for (const e of list) {
            if (e.name) { // raw vasco effect
                const fx = this.animatable({ ...e }, fps, n);
                this.doc.effects.push(fx);
                ids.push(this.doc.effects.length - 1);
                continue;
            }
            switch (e.type) {
                case 'blur': {
                    const fx = {
                        name: 'blur',
                        blurriness: e.amount ?? e.blurriness ?? 5,
                        dimensions: e.dimensions ?? 'both',
                        repeat_edge_pixels: e.repeat_edge ?? e.repeat_edge_pixels ?? false,
                    };
                    if (e.animate) { fx.animate = e.animate; this.animatable(fx, fps, n, { amount: 'blurriness' }); }
                    this.doc.effects.push(fx);
                    ids.push(this.doc.effects.length - 1);
                    break;
                }
                case 'corner_pin': {
                    const fx = {
                        name: 'corner_pin',
                        from_pins: pins(e.from ?? e.from_pins),
                        to_pins: pins(e.to ?? e.to_pins),
                        crop_to_pins: e.crop ?? e.crop_to_pins ?? 0,
                    };
                    if (e.overlay_mode !== undefined) fx.overlay_mode = e.overlay_mode;
                    if (e.animate) {
                        fx.animate = {};
                        for (const [ch, kfs] of Object.entries(e.animate))
                            fx.animate[ch.replace(/^from\./, 'from_pins.').replace(/^to\./, 'to_pins.')] = kfs;
                        this.animatable(fx, fps, n);
                    }
                    this.doc.effects.push(fx);
                    ids.push(this.doc.effects.length - 1);
                    break;
                }
                case 'shadow': case 'glow': case 'stroke': case 'overlay': {
                    const section = { shadow: 'drop_shadow', glow: 'outer_glow', stroke: 'stroke', overlay: 'overlay' }[e.type];
                    const fx = styleId();
                    const sub = { enabled: true };
                    const keys = {
                        shadow: ['opacity', 'angle', 'distance', 'spread', 'size', 'knock'],
                        glow: ['opacity', 'spread', 'size', 'range'],
                        stroke: ['size', 'opacity', 'position'],
                        overlay: ['opacity'],
                    }[e.type];
                    if (e.color !== undefined) sub.color = color(e.color, 4);
                    if (e.type === 'overlay' && e.blend !== undefined) sub.blend_mode = e.blend;
                    for (const k of keys) if (e[k] !== undefined) sub[k] = e[k];
                    fx[section] = sub;
                    if (e.animate) {
                        const animate = {};
                        for (const [ch, kfs] of Object.entries(e.animate))
                            animate[`${section}.${ch}`] = ch === 'color'
                                ? kfs.map(k => ({ ...k, v: color(k.v, 4) }))
                                : kfs;
                        fx.animate = animate;
                        this.animatable(fx, fps, n);
                    }
                    break;
                }
                default:
                    throw new Error(`Unknown effect ${JSON.stringify(e.type)} — use blur, corner_pin, shadow, glow, stroke, overlay, or a raw vasco effect with "name"`);
            }
        }
        return ids;
    }
}

export function compileScene(scene, sceneDir) {
    return new Compiler(scene, sceneDir).compile();
}
