// Easing functions for the tween engine.
// Accepts names like "outCubic", "ease-out-cubic", "easeInOutQuad", "linear", "hold",
// or a cubic-bezier as [x1, y1, x2, y2].

const PI = Math.PI;
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * PI) / 3;
const c5 = (2 * PI) / 4.5;

function bounceOut(x) {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

const EASINGS = {
    linear: x => x,
    hold: () => 0,

    inquad: x => x * x,
    outquad: x => 1 - (1 - x) * (1 - x),
    inoutquad: x => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2,

    incubic: x => x ** 3,
    outcubic: x => 1 - (1 - x) ** 3,
    inoutcubic: x => x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2,

    inquart: x => x ** 4,
    outquart: x => 1 - (1 - x) ** 4,
    inoutquart: x => x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2,

    inquint: x => x ** 5,
    outquint: x => 1 - (1 - x) ** 5,
    inoutquint: x => x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2,

    insine: x => 1 - Math.cos((x * PI) / 2),
    outsine: x => Math.sin((x * PI) / 2),
    inoutsine: x => -(Math.cos(PI * x) - 1) / 2,

    inexpo: x => x === 0 ? 0 : 2 ** (10 * x - 10),
    outexpo: x => x === 1 ? 1 : 1 - 2 ** (-10 * x),
    inoutexpo: x => x === 0 ? 0 : x === 1 ? 1 :
        x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2,

    incirc: x => 1 - Math.sqrt(1 - x ** 2),
    outcirc: x => Math.sqrt(1 - (x - 1) ** 2),
    inoutcirc: x => x < 0.5
        ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2
        : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2,

    inback: x => c3 * x ** 3 - c1 * x ** 2,
    outback: x => 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2,
    inoutback: x => x < 0.5
        ? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2
        : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2,

    inelastic: x => x === 0 ? 0 : x === 1 ? 1 :
        -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * c4),
    outelastic: x => x === 0 ? 0 : x === 1 ? 1 :
        2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1,
    inoutelastic: x => x === 0 ? 0 : x === 1 ? 1 : x < 0.5
        ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
        : (2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1,

    inbounce: x => 1 - bounceOut(1 - x),
    outbounce: bounceOut,
    inoutbounce: x => x < 0.5
        ? (1 - bounceOut(1 - 2 * x)) / 2
        : (1 + bounceOut(2 * x - 1)) / 2,
};

// CSS-style aliases.
EASINGS['ease'] = EASINGS.inoutcubic;
EASINGS['in'] = EASINGS.incubic;
EASINGS['out'] = EASINGS.outcubic;
EASINGS['inout'] = EASINGS.inoutcubic;
EASINGS['step'] = EASINGS.hold;

function cubicBezier(x1, y1, x2, y2) {
    const bez = (t, a, b) => 3 * t * (1 - t) ** 2 * a + 3 * t * t * (1 - t) * b + t ** 3;
    return x => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        // bisection solve for t where bez(t, x1, x2) == x
        let lo = 0, hi = 1, t = x;
        for (let i = 0; i < 30; i++) {
            const cx = bez(t, x1, x2);
            if (Math.abs(cx - x) < 1e-5) break;
            if (cx < x) lo = t; else hi = t;
            t = (lo + hi) / 2;
        }
        return bez(t, y1, y2);
    };
}

export function getEase(spec) {
    if (spec == null) return EASINGS.linear;
    if (Array.isArray(spec) && spec.length === 4) return cubicBezier(...spec);
    if (typeof spec === 'string') {
        const key = spec.toLowerCase().replace(/[-_\s]/g, '').replace(/^ease(?=.)/, '');
        const fn = EASINGS[key];
        if (fn) return fn;
    }
    throw new Error(`Unknown easing ${JSON.stringify(spec)}. Use linear, hold, in/out/inOut + Quad|Cubic|Quart|Quint|Sine|Expo|Circ|Back|Elastic|Bounce, or a cubic-bezier [x1,y1,x2,y2].`);
}
