const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "toronto_heat_data.js");
const OUT = path.join(__dirname, "toronto_heat_data.json");
const SS = process.env.SS_PATH || path.join(__dirname, "vendor", "simple-statistics.min.js");

const PRECISION = 5;
const TOLERANCE = 2e-5;

const ROUND_PROPS = {
  avg_sumr: 2,
  ndvi_mean: 4,
  warming: 2,
  Z_Score: 3,
  minority_percent: 2,
  POPDEN: 1,
};

const KEEP_PROPS = [
  "CTUID",
  "avg_sumr",
  "ndvi_mean",
  "warming",
  "Z_Score",
  "risk_category",
  "minority_percent",
  "INCOME",
  "POPULATION",
  "POPDEN",
  "RENTER",
  "OWNER",
];

const BREAK_FIELDS = {
  temp: "avg_sumr",
  ndvi: "ndvi_mean",
  warming: "warming",
  income: "INCOME",
  minority: "minority_percent",
};

function loadSource() {
  const sandbox = {};
  vm.createContext(sandbox);
  const code = fs.readFileSync(SRC, "utf8") + ";globalThis.__data = censusData;";
  vm.runInContext(code, sandbox);
  return sandbox.__data;
}

function quantize(ring) {
  const f = Math.pow(10, PRECISION);
  const out = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * f) / f, Math.round(y * f) / f];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

function simplify(ring, tol) {
  if (ring.length < 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const tol2 = tol * tol;
  const stack = [[0, ring.length - 1]];

  while (stack.length) {
    const [a, b] = stack.pop();
    if (b <= a + 1) continue;
    const [x1, y1] = ring[a];
    const [x2, y2] = ring[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;

    let worst = -1;
    let worstIdx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = ring[i];
      let t = len2 === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x1 + t * dx - x;
      const ey = y1 + t * dy - y;
      const d2 = ex * ex + ey * ey;
      if (d2 > worst) {
        worst = d2;
        worstIdx = i;
      }
    }

    if (worst > tol2) {
      keep[worstIdx] = 1;
      stack.push([a, worstIdx], [worstIdx, b]);
    }
  }

  const out = ring.filter((_, i) => keep[i]);
  return out.length < 4 ? ring : out;
}

function reduceProps(props) {
  const out = {};
  for (const key of KEEP_PROPS) {
    let v = props[key];
    if (key in ROUND_PROPS && v !== null && v !== undefined) {
      const f = Math.pow(10, ROUND_PROPS[key]);
      v = Math.round(parseFloat(v) * f) / f;
    }
    out[key] = v;
  }
  return out;
}

function main() {
  const ss = require(SS);
  const src = loadSource();

  let before = 0;
  let after = 0;

  const features = src.features.map((f) => {
    const coordinates = f.geometry.coordinates.map((poly) =>
      poly.map((ring) => {
        before += ring.length;
        const out = simplify(quantize(ring), TOLERANCE);
        after += out.length;
        return out;
      }),
    );
    return {
      type: "Feature",
      properties: reduceProps(f.properties),
      geometry: { type: "MultiPolygon", coordinates },
    };
  });

  const breaks = {};
  for (const [name, field] of Object.entries(BREAK_FIELDS)) {
    const values = features
      .map((f) => parseFloat(f.properties[field]))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    breaks[name] = values.length
      ? ss.ckmeans(values, 5).map((c) => c[c.length - 1])
      : [0, 0, 0, 0, 0];
  }

  const payload = {
    breaks,
    geo: { type: "FeatureCollection", features },
  };

  fs.writeFileSync(OUT, JSON.stringify(payload));

  const srcKb = fs.statSync(SRC).size / 1024;
  const outKb = fs.statSync(OUT).size / 1024;
  console.log(`features   ${features.length}`);
  console.log(`vertices   ${before} -> ${after}`);
  console.log(`size       ${srcKb.toFixed(0)} KB -> ${outKb.toFixed(0)} KB`);
}

main();
