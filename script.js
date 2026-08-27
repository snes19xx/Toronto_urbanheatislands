const NDVI_COEF = -6.4;
const MB_TOKEN =
  "pk.eyJ1Ijoic25lczE5eHgiLCJhIjoiY21scmgybmMxMGJyMjNlcG41cHllencyeSJ9.RTIqSU1jFU7TiidODxkttA";
const DATA_URL = "toronto_heat_data.json";

let map, geoLayer, tileLayer;
let selectedFeature = null;
let selectedLayer = null;
let currentLayer = "clusters";
let hasClickedTract = false;

let dataBreaks = { temp: [], ndvi: [], warming: [], income: [], minority: [] };

const COLORS = {
  border: "#14161ced",
  highlight: "#e8935fed",
  hotspot: "#e2483ded",
  rapidWarming: "#f0a879ed",

  red1: "#fdeee7ed",
  red2: "#f8c4aeed",
  red3: "#f1906aed",
  red4: "#e2493ded",
  red5: "#a3243ded",

  green1: "#eef6eeed",
  green2: "#bfe0c4ed",
  green3: "#7cc596ed",
  green4: "#379668ed",
  green5: "#1a5f4aed",

  warm1: "#f9e6c8ed",
  warm2: "#f0c179ed",
  warm3: "#e2963fed",
  warm4: "#cf6a2eed",
  warm5: "#a3243ded",
};

const RAMPS = {
  temp: ["red1", "red2", "red3", "red4", "red5"],
  ndvi: ["green1", "green2", "green3", "green4", "green5"],
  warming: ["warm1", "warm2", "warm3", "warm4", "warm5"],
};

const LAYER_FIELDS = {
  temp: "avg_sumr",
  ndvi: "ndvi_mean",
  warming: "warming",
};

const LEGEND_TEXT = {
  clusters: {
    label: "Legend",
    desc: "Statistically significant hot spots (Gi*, p < 0.05) and areas of rapid seasonal warming (emerging risk category).",
  },
  temp: {
    label: "Surface temperature",
    desc: "Land surface temperature classified by Jenks natural breaks.",
    unit: "°C",
  },
  ndvi: {
    label: "Vegetation (NDVI)",
    desc: "Normalised Difference Vegetation Index. Higher values indicate greater canopy density.",
    unit: "",
  },
  warming: {
    label: "Seasonal warming",
    desc: "Increase in land surface temperature from May to August.",
    unit: "°C",
  },
};

const RISK_LABELS = {
  "Critical: Hot & Intensifying": "Critical heat",
  "Rapid Warming": "Rapid warming",
  "Hot but Stable": "Heat island",
  "Low Risk": "Low risk",
};

const RISK_CLASSES = {
  "Critical: Hot & Intensifying": "risk-critical",
  "Rapid Warming": "risk-emerging",
  "Hot but Stable": "risk-chronic",
  "Low Risk": "risk-low",
};

const BASEMAPS = {
  mapbox: {
    url:
      "https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=" +
      MB_TOKEN,
    opts: {
      attribution: "© OpenStreetMap contributors © Mapbox",
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
    },
    theme: "dark",
  },
  carto: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    opts: {
      attribution: "© OpenStreetMap contributors © CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    },
    theme: "dark",
  },
  esri: {
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    opts: {
      attribution: "© OpenStreetMap contributors © Esri",
      maxZoom: 16,
    },
    theme: "dark",
  },
  stamen: {
    url: "https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png",
    opts: {
      attribution:
        "© OpenStreetMap contributors © Stamen Design © Stadia Maps © OpenMapTiles",
      maxZoom: 20,
    },
    theme: "light",
  },
};

const $ = (id) => document.getElementById(id);

init();

function init() {
  map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
    renderer: L.canvas({ padding: 0.4 }),
  }).setView([43.7, -79.42], 11);

  L.control.zoom({ position: "bottomright" }).addTo(map);
  switchBaseMap("stamen");
  updateLegend();

  $("base-map-selector").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-basemap]");
    if (btn) switchBaseMap(btn.dataset.basemap);
  });

  $("layer-selector").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-layer]");
    if (btn) switchLayer(btn.dataset.layer);
  });

  $("close-panel").addEventListener("click", closePanel);

  $("ndvi-slider").addEventListener("input", function () {
    updateSliderFill(this);
    if (selectedFeature) updateSimulation(this.value);
  });

  loadData();
}

function loadData() {
  const prompt = $("map-click-prompt");

  fetch(DATA_URL, { credentials: "omit" })
    .then((res) => {
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      return res.json();
    })
    .then((payload) => {
      dataBreaks = payload.breaks;
      renderGeoJSON(payload.geo);
      updateLegend();
      prompt.textContent =
        "Select a census tract to model vegetation interventions";
    })
    .catch((err) => {
      prompt.textContent = "Could not load tract data (" + err.message + ")";
    });
}

function setTheme(theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    COLORS.border = "#cccccc";
    COLORS.highlight = "#882218";
  } else {
    document.documentElement.removeAttribute("data-theme");
    COLORS.border = "#1a1c24";
    COLORS.highlight = "#c47840";
  }
  restyleAll();
}

function switchBaseMap(styleId) {
  const cfg = BASEMAPS[styleId];
  if (!cfg) return;

  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(cfg.url, cfg.opts).addTo(map);
  setTheme(cfg.theme);

  document.querySelectorAll(".basemap-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.basemap === styleId);
  });
}

function switchLayer(layerId) {
  currentLayer = layerId;

  document.querySelectorAll(".layer-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.layer === layerId);
  });

  updateLegend();
  restyleAll();
}

function restyleAll() {
  if (!geoLayer) return;
  geoLayer.setStyle(styleFor);
  if (selectedLayer) highlight(selectedLayer, 3);
}

function getClusterColor(props) {
  if (props.Z_Score > 1.96) return COLORS.hotspot;
  if (props.risk_category && props.risk_category.includes("Rapid Warming"))
    return COLORS.rapidWarming;
  return "#ffffff";
}

function getFillColor(props) {
  if (currentLayer === "clusters") return getClusterColor(props);

  const ramp = RAMPS[currentLayer];
  if (!ramp) return "#ccc";

  const breaks = dataBreaks[currentLayer];
  const val = props[LAYER_FIELDS[currentLayer]];
  for (let i = 0; i < 4; i++) {
    if (val <= breaks[i]) return COLORS[ramp[i]];
  }
  return COLORS[ramp[4]];
}

function getOpacity(props) {
  if (currentLayer !== "clusters") return 0.85;
  if (props.Z_Score > 1.96) return 0.85;
  if (props.risk_category && props.risk_category.includes("Rapid Warming"))
    return 0.85;
  return 0;
}

function styleFor(feature) {
  return {
    fillColor: getFillColor(feature.properties),
    weight: 1,
    opacity: 1,
    color: COLORS.border,
    fillOpacity: getOpacity(feature.properties),
  };
}

function highlight(layer, weight) {
  layer.setStyle({ weight, color: COLORS.highlight, fillOpacity: 1 });
}

function renderGeoJSON(data) {
  if (geoLayer) map.removeLayer(geoLayer);

  geoLayer = L.geoJSON(data, {
    style: styleFor,
    onEachFeature: (feature, layer) => {
      layer.on("mouseover", function () {
        if (this === selectedLayer) return;
        const p = feature.properties;
        if (
          currentLayer !== "clusters" ||
          p.Z_Score > 1.96 ||
          (p.risk_category && p.risk_category.includes("Rapid Warming"))
        ) {
          highlight(this, 2);
        }
      });
      layer.on("mouseout", function () {
        if (this !== selectedLayer) geoLayer.resetStyle(this);
      });
      layer.on("click", function () {
        selectTract(feature, this);
      });
    },
  }).addTo(map);
}

function legendRow(color, label, empty) {
  const row = document.createElement("div");
  row.className = "legend-row";

  const swatch = document.createElement("span");
  swatch.className = empty
    ? "legend-swatch legend-swatch-empty"
    : "legend-swatch";
  if (!empty) swatch.style.background = color;

  const text = document.createElement("span");
  text.textContent = label;

  row.append(swatch, text);
  return row;
}

function updateLegend() {
  const cfg = LEGEND_TEXT[currentLayer];
  const content = $("legend-content");

  $("legend-title").textContent = cfg.label;
  $("layer-description").textContent = cfg.desc;
  content.replaceChildren();

  if (currentLayer === "clusters") {
    content.append(
      legendRow(COLORS.hotspot, "Heat island (hotspot)"),
      legendRow(COLORS.rapidWarming, "Rapid warming (emerging)"),
      legendRow(null, "Not significant", true),
    );
    return;
  }

  const breaks = dataBreaks[currentLayer];
  if (!breaks || !breaks.length) return;

  const fmt = (n) => n.toFixed(1).replace(/\.0$/, "") + cfg.unit;
  const ramp = RAMPS[currentLayer];
  let prev = 0;

  for (let i = 0; i < 5; i++) {
    content.append(
      legendRow(COLORS[ramp[i]], fmt(prev) + " – " + fmt(breaks[i])),
    );
    prev = breaks[i];
  }
}

function selectTract(feature, layer) {
  if (!hasClickedTract) {
    $("map-click-prompt").classList.add("hidden");
    hasClickedTract = true;
  }

  if (selectedLayer) geoLayer.resetStyle(selectedLayer);
  selectedFeature = feature;
  selectedLayer = layer;
  highlight(layer, 3);

  $("simulation-panel").classList.add("open");
  $("empty-state").classList.add("hidden");
  $("active-content").classList.remove("hidden");

  const props = feature.properties;
  const rawRisk = props.risk_category || "Low Risk";
  const renters = parseInt(props.RENTER);
  const owners = parseInt(props.OWNER);
  const renterPct =
    renters + owners > 0 ? (renters / (renters + owners)) * 100 : 0;

  $("tract-id").textContent = props.CTUID;

  const badge = $("risk-badge");
  badge.textContent = RISK_LABELS[rawRisk] || rawRisk;
  badge.className = "risk-badge " + (RISK_CLASSES[rawRisk] || "risk-low");

  $("demo-income").textContent =
    "$" + Math.round(parseFloat(props.INCOME)).toLocaleString();
  $("demo-minority").textContent =
    parseFloat(props.minority_percent).toFixed(1) + "%";
  $("demo-population").textContent = parseInt(
    props.POPULATION,
  ).toLocaleString();
  $("demo-popden").textContent = Math.round(
    parseFloat(props.POPDEN),
  ).toLocaleString();
  $("demo-renters").textContent = renterPct.toFixed(1) + "%";
  $("demo-warming").textContent = parseFloat(props.warming).toFixed(1) + "°C";
  $("curr-temp").textContent = parseFloat(props.avg_sumr).toFixed(1) + "°C";

  const slider = $("ndvi-slider");
  slider.value = parseFloat(props.ndvi_mean);
  updateSliderFill(slider);
  updateSimulation(props.ndvi_mean);
}

function closePanel() {
  $("simulation-panel").classList.remove("open");
  if (selectedLayer) geoLayer.resetStyle(selectedLayer);
  selectedFeature = null;
  selectedLayer = null;
}

function updateSliderFill(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.backgroundSize = pct + "% 100%";
}

function updateSimulation(newVal) {
  const props = selectedFeature.properties;
  const origNDVI = parseFloat(props.ndvi_mean);
  const origTemp = parseFloat(props.avg_sumr);
  const newNDVI = parseFloat(newVal);
  const tempChange = (newNDVI - origNDVI) * NDVI_COEF;
  const newTemp = origTemp + tempChange;

  $("ndvi-val").textContent = (newNDVI * 100).toFixed(0) + "%";

  const projEl = $("proj-temp");
  const deltaRow = $("delta-badge");
  const deltaTxt = $("temp-change");

  projEl.textContent = newTemp.toFixed(1) + "°C";

  if (Math.abs(tempChange) > 0.05) {
    const cooler = tempChange < 0;
    deltaRow.classList.remove("hidden");
    deltaTxt.textContent = (cooler ? "" : "+") + tempChange.toFixed(1) + "°C";
    projEl.className = "temp-val " + (cooler ? "cooler" : "warmer");
    deltaTxt.className = "delta-val " + (cooler ? "cooler" : "warmer");
  } else {
    deltaRow.classList.add("hidden");
    projEl.className = "temp-val";
  }
}
