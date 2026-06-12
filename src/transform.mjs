// Composes a VASCO 4x4 transform matrix (column-major, translation at [12..14])
// from compact position / scale / rotation values.
//   position: [x,y] | [x,y,z]
//   scale:    s | [sx,sy] | [sx,sy,sz]
//   rotation: zDeg | [xDeg,yDeg,zDeg]

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function vec3(v, fill) {
    if (typeof v === 'number') return [v, v, v];
    return [v[0] ?? fill, v[1] ?? fill, v[2] ?? fill];
}

// column-major multiply: out = A * B
function mul(A, B) {
    const out = new Array(16);
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++) {
            let s = 0;
            for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k];
            out[c * 4 + r] = s;
        }
    return out;
}

// The engine applies this matrix as-is (anchor_point is NOT subtracted by it),
// so the anchor is folded in here: M = T(position) * R * S * T(-anchor).
// position defaults to the anchor, so an anchored layer scales/rotates in place.
export function composeTransform(position, scale, rotation, anchor) {
    const [ax, ay, az] = anchor == null ? [0, 0, 0] : vec3(anchor, 0);
    const [px, py, pz] = position == null ? [ax, ay, az] : vec3(position, 0);
    const [sx, sy, sz] = scale == null ? [1, 1, 1]
        : typeof scale === 'number' ? [scale, scale, scale]
        : [scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1];
    const rdeg = rotation == null ? [0, 0, 0]
        : typeof rotation === 'number' ? [0, 0, rotation]
        : [rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0];
    const [rx, ry, rz] = rdeg.map(d => d * Math.PI / 180);

    let M = [
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        0, 0, 0, 1,
    ];
    if (rx) {
        const c = Math.cos(rx), s = Math.sin(rx);
        M = mul([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1], M);
    }
    if (ry) {
        const c = Math.cos(ry), s = Math.sin(ry);
        M = mul([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1], M);
    }
    if (rz) {
        const c = Math.cos(rz), s = Math.sin(rz);
        M = mul([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], M);
    }
    M[12] = px; M[13] = py; M[14] = pz;
    if (ax || ay || az)
        M = mul(M, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -ax, -ay, -az, 1]);
    return M;
}

export function isIdentityInput(position, scale, rotation) {
    return position == null && scale == null && rotation == null;
}

export { IDENTITY };
