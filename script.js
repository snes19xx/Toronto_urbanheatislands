const NDVI_COEF = -6.4;
const MB_TOKEN =
  "pk.eyJ1Ijoic25lczE5eHgiLCJhIjoiY21scmgybmMxMGJyMjNlcG41cHllencyeSJ9.RTIqSU1jFU7TiidODxkttA";

let map, geoLayer, tileLayer;
let selectedFeature = null;
let currentLayer = "clusters";
let hasClickedTract = false;

let dataBreaks = { temp: [], ndvi: [], warming: [], income: [], minority: [] };

const COLORS = {
  border: "#1a1c24",
  highlight: "#c47840",
  hotspot: "#d73027",
  rapidWarming: "#e69875",
  red1: "#fee5d9",
  red2: "#fcae91",
  red3: "#fb6a4a",
  red4: "#de2d26",
  red5: "#a50f15",
  green1: "#edf8e9",
  green2: "#bae4b3",
  green3: "#74c476",
  green4: "#31a354",
  green5: "#006d2c",
  warm1: "#ffffb2",
  warm2: "#fecc5c",
  warm3: "#fd8d3c",
  warm4: "#f03b20",
  warm5: "#bd0026",
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
  if (geoLayer) {
    geoLayer.eachLayer((l) => {
      geoLayer.resetStyle(l);
      l.setStyle({
        color: COLORS.border,
        fillColor: getFillColor(l.feature.properties),
        fillOpacity: getOpacity(l.feature.properties),
      });
    });
    if (selectedFeature) {
      geoLayer.eachLayer((l) => {
        if (l.feature === selectedFeature) {
          l.setStyle({ weight: 3, color: COLORS.highlight, fillOpacity: 1 });
        }
      });
    }
  }
}

window.onload = function () {
  map = L.map("map", { zoomControl: false }).setView([43.7, -79.42], 11);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  switchBaseMap("stamen");

  if (typeof censusData !== "undefined") {
    calculateBreaks();
    loadGeoJSON(censusData);
    updateLegend();
  } else {
    alert("Data file 'toronto_heat_data.js' not found.");
  }

  document.getElementById("ndvi-slider").oninput = function () {
    updateSliderFill(this);
    if (selectedFeature) updateSimulation(this.value);
  };
};

function switchBaseMap(styleId) {
  if (tileLayer) map.removeLayer(tileLayer);

  const OSM = "© OpenStreetMap contributors";

  const configs = {
    mapbox: {
      url:
        "https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=" +
        MB_TOKEN,
      opts: {
        attribution: OSM + " © Mapbox",
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 19,
      },
      theme: "dark",
    },
    carto: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      opts: { attribution: OSM + " © CARTO", subdomains: "abcd", maxZoom: 19 },
      theme: "dark",
    },
    esri: {
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      opts: { attribution: OSM + " © Esri", maxZoom: 16 },
      theme: "dark",
    },
    stamen: {
      url: "https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png",
      opts: {
        attribution:
          OSM + " © Stamen Design © Stadia Maps © OpenMapTiles",
        maxZoom: 20,
      },
      theme: "light",
    },
  };

  const cfg = configs[styleId];
  if (!cfg) return;

  tileLayer = L.tileLayer(cfg.url, cfg.opts).addTo(map);
  setTheme(cfg.theme);

  document
    .querySelectorAll(".basemap-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.getElementById("base-" + styleId).classList.add("active");
}

function calculateBreaks() {
  const getValues = (prop) =>
    censusData.features
      .map((f) => parseFloat(f.properties[prop]))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

  const jenks = (data) =>
    data.length === 0
      ? [0, 0, 0, 0, 0]
      : ss.ckmeans(data, 5).map((c) => c[c.length - 1]);

  dataBreaks.temp = jenks(getValues("avg_sumr"));
  dataBreaks.ndvi = jenks(getValues("ndvi_mean"));
  dataBreaks.warming = jenks(getValues("warming"));
  dataBreaks.income = jenks(getValues("INCOME"));
  dataBreaks.minority = jenks(getValues("minority_percent"));
}

function getClusterColor(props) {
  if (props.Z_Score > 1.96) return COLORS.hotspot;
  if (props.risk_category && props.risk_category.includes("Rapid Warming"))
    return COLORS.rapidWarming;
  return "#ffffff";
}

function getNaturalColor(val, breaks, colors) {
  for (let i = 0; i < 4; i++) {
    if (val <= breaks[i]) return colors[i];
  }
  return colors[4];
}

function getFillColor(props) {
  if (currentLayer === "clusters") return getClusterColor(props);
  if (currentLayer === "temp")
    return getNaturalColor(props.avg_sumr, dataBreaks.temp, [
      COLORS.red1,
      COLORS.red2,
      COLORS.red3,
      COLORS.red4,
      COLORS.red5,
    ]);
  if (currentLayer === "ndvi")
    return getNaturalColor(props.ndvi_mean, dataBreaks.ndvi, [
      COLORS.green1,
      COLORS.green2,
      COLORS.green3,
      COLORS.green4,
      COLORS.green5,
    ]);
  if (currentLayer === "warming")
    return getNaturalColor(props.warming, dataBreaks.warming, [
      COLORS.warm1,
      COLORS.warm2,
      COLORS.warm3,
      COLORS.warm4,
      COLORS.warm5,
    ]);
  return "#ccc";
}

function getOpacity(props) {
  if (currentLayer === "clusters") {
    if (props.Z_Score > 1.96) return 0.85;
    if (props.risk_category && props.risk_category.includes("Rapid Warming"))
      return 0.85;
    return 0.0;
  }
  return 0.85;
}

function loadGeoJSON(data) {
  if (geoLayer) map.removeLayer(geoLayer);

  geoLayer = L.geoJSON(data, {
    style: (feature) => ({
      fillColor: getFillColor(feature.properties),
      weight: 1,
      opacity: 1,
      color: COLORS.border,
      fillOpacity: getOpacity(feature.properties),
    }),
    onEachFeature: (feature, layer) => {
      layer.on("mouseover", function () {
        const p = feature.properties;
        if (
          currentLayer !== "clusters" ||
          p.Z_Score > 1.96 ||
          (p.risk_category && p.risk_category.includes("Rapid Warming"))
        ) {
          this.setStyle({ weight: 2, color: COLORS.highlight, fillOpacity: 1 });
        }
      });
      layer.on("mouseout", function () {
        if (selectedFeature !== feature) geoLayer.resetStyle(this);
      });
      layer.on("click", function () {
        selectTract(feature, layer);
      });
    },
  }).addTo(map);
}

function switchLayer(layerId) {
  currentLayer = layerId;

  document
    .querySelectorAll(".layer-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.getElementById("btn-" + layerId);
  if (activeBtn) activeBtn.classList.add("active");

  updateLegend();

  if (geoLayer) {
    geoLayer.eachLayer((layer) => {
      layer.setStyle({
        fillColor: getFillColor(layer.feature.properties),
        fillOpacity: getOpacity(layer.feature.properties),
      });
    });
  }
}

function updateLegend() {
  const title = document.getElementById("legend-title");
  const desc = document.getElementById("layer-description");
  const content = document.getElementById("legend-content");

  const fmt = (n, u) => n.toFixed(1).replace(/\.0$/, "") + u;

  const jenksRows = (breaks, colors, unit) => {
    let prev = 0,
      html = "";
    for (let i = 0; i < 5; i++) {
      html += `<div class="legend-row">
        <span class="legend-swatch" style="background:${colors[i]};"></span>
        <span>${fmt(prev, unit)} – ${fmt(breaks[i], unit)}</span>
      </div>`;
      prev = breaks[i];
    }
    return html;
  };

  if (currentLayer === "clusters") {
    title.textContent = "Legend";
    desc.textContent =
      "Statistically significant hot spots (Gi*, p < 0.05) and areas of rapid seasonal warming (emerging risk category).";
    content.innerHTML = `
      <div class="legend-row"><span class="legend-swatch" style="background:#d73027;"></span><span>Heat island (hotspot)</span></div>
      <div class="legend-row"><span class="legend-swatch" style="background:#e69875;"></span><span>Rapid warming (emerging)</span></div>
      <div class="legend-row"><span class="legend-swatch legend-swatch-empty"></span><span>Not significant</span></div>`;
    return;
  }

  const cfgs = {
    temp: {
      label: "Surface temperature",
      desc: "Land surface temperature classified by Jenks natural breaks.",
      unit: "°C",
      breaks: dataBreaks.temp,
      colors: [COLORS.red1, COLORS.red2, COLORS.red3, COLORS.red4, COLORS.red5],
    },
    ndvi: {
      label: "Vegetation (NDVI)",
      desc: "Normalised Difference Vegetation Index. Higher values indicate greater canopy density.",
      unit: "",
      breaks: dataBreaks.ndvi,
      colors: [
        COLORS.green1,
        COLORS.green2,
        COLORS.green3,
        COLORS.green4,
        COLORS.green5,
      ],
    },
    warming: {
      label: "Seasonal warming",
      desc: "Increase in land surface temperature from May to August.",
      unit: "°C",
      breaks: dataBreaks.warming,
      colors: [
        COLORS.warm1,
        COLORS.warm2,
        COLORS.warm3,
        COLORS.warm4,
        COLORS.warm5,
      ],
    },
  };

  const cfg = cfgs[currentLayer];
  title.textContent = cfg.label;
  desc.textContent = cfg.desc;
  content.innerHTML = jenksRows(cfg.breaks, cfg.colors, cfg.unit);
}

function selectTract(feature, layer) {
  if (!hasClickedTract) {
    document.getElementById("map-click-prompt").classList.add("hidden");
    hasClickedTract = true;
  }

  selectedFeature = feature;
  geoLayer.eachLayer((l) => geoLayer.resetStyle(l));
  layer.setStyle({ weight: 3, color: COLORS.highlight, fillOpacity: 1 });

  const panel = document.getElementById("simulation-panel");
  panel.classList.add("open");
  document.getElementById("empty-state").classList.add("hidden");
  document.getElementById("active-content").classList.remove("hidden");

  const props = feature.properties;
  const rawRisk = props.risk_category || "Low Risk";
  const renterPct =
    props.RENTER + props.OWNER > 0
      ? (parseInt(props.RENTER) /
          (parseInt(props.RENTER) + parseInt(props.OWNER))) *
        100
      : 0;

  document.getElementById("tract-id").textContent = props.CTUID;

  const badge = document.getElementById("risk-badge");
  badge.textContent = RISK_LABELS[rawRisk] || rawRisk;
  badge.className = "risk-badge " + (RISK_CLASSES[rawRisk] || "risk-low");

  document.getElementById("demo-income").textContent =
    "$" + Math.round(parseFloat(props.INCOME)).toLocaleString();
  document.getElementById("demo-minority").textContent =
    parseFloat(props.minority_percent).toFixed(1) + "%";
  document.getElementById("demo-population").textContent = parseInt(
    props.POPULATION,
  ).toLocaleString();
  document.getElementById("demo-popden").textContent = parseFloat(props.POPDEN)
    .toFixed(0)
    .toLocaleString();
  document.getElementById("demo-renters").textContent =
    renterPct.toFixed(1) + "%";
  document.getElementById("demo-warming").textContent =
    parseFloat(props.warming).toFixed(1) + "°C";
  document.getElementById("curr-temp").textContent =
    parseFloat(props.avg_sumr).toFixed(1) + "°C";

  const slider = document.getElementById("ndvi-slider");
  slider.value = parseFloat(props.ndvi_mean);
  updateSliderFill(slider);
  updateSimulation(props.ndvi_mean);
}

function closePanel() {
  document.getElementById("simulation-panel").classList.remove("open");
  if (geoLayer) geoLayer.resetStyle();
  selectedFeature = null;
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

  document.getElementById("ndvi-val").textContent =
    (newNDVI * 100).toFixed(0) + "%";

  const projEl = document.getElementById("proj-temp");
  const deltaRow = document.getElementById("delta-badge");
  const deltaTxt = document.getElementById("temp-change");

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
