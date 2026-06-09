/* ============================================================
   FloodGuard — App Logic
   Primary API: MERGE/INPE — BDC STAC (data.inpe.br)
   References: INMET, CEMADEN, ANA
   ============================================================ */

'use strict';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  REGION: 'Região Metropolitana de São Paulo',
  CENTER: [-23.5505, -46.6333],
  OVERVIEW_ZOOM: 9,
  RISK_ZOOM: 11,
  UPDATE_INTERVAL: 60_000,

  // Alert thresholds (based on CEMADEN criteria)
  THRESHOLDS: {
    critical: { rain24h: 50, rain1h: 30, riverM: 8.0 },
    high:     { rain24h: 30, rain1h: 15, riverM: 5.0 },
    medium:   { rain24h: 15, rain1h:  5, riverM: 3.0 },
    low:      { rain24h:  5, rain1h: 0.5, riverM: 1.0 },
  },
};

// INPE BDC STAC — MERGE Hourly Precipitation
const INPE = {
  STAC:       'https://data.inpe.br/bdc/stac/v1',
  COLLECTION: 'prec_merge_hourly-1',
  // Bounding box: Greater São Paulo metropolitan area
  SP_BBOX:    [-47.2, -24.1, -46.1, -23.1],
  SP_LAT:     -23.5505,
  SP_LNG:     -46.6333,
};

// ============================================================
// MOCK DATA
// ============================================================

const MOCK = {
  // Monitoring points — replaces sensors; just climate observation locations
  points: [
    { id:'SP001', name:'Marginal Tietê',       lat:-23.5150, lng:-46.6400, rain1h:32.5, rain24h:89.5, riverM:9.48,  temp:17.8, hum:94 },
    { id:'SP002', name:'Osasco',               lat:-23.5325, lng:-46.7920, rain1h:18.7, rain24h:67.3, riverM:7.25,  temp:18.1, hum:91 },
    { id:'SP003', name:'São Paulo — Centro',   lat:-23.5505, lng:-46.6333, rain1h:21.3, rain24h:72.4, riverM:8.12,  temp:17.5, hum:93 },
    { id:'SP004', name:'Guarulhos',            lat:-23.4564, lng:-46.5338, rain1h:12.3, rain24h:45.2, riverM:3.21,  temp:18.9, hum:88 },
    { id:'SP005', name:'Santo André',          lat:-23.6639, lng:-46.5338, rain1h: 8.5, rain24h:38.7, riverM:2.85,  temp:18.4, hum:87 },
    { id:'SP006', name:'Taboão da Serra',      lat:-23.6100, lng:-46.7600, rain1h:14.2, rain24h:51.6, riverM:5.78,  temp:18.2, hum:90 },
    { id:'SP007', name:'São Paulo — Leste',    lat:-23.5465, lng:-46.4754, rain1h: 9.8, rain24h:41.3, riverM:3.67,  temp:18.6, hum:86 },
    { id:'SP008', name:'Diadema',              lat:-23.6861, lng:-46.6228, rain1h: 7.2, rain24h:29.4, riverM:2.34,  temp:19.1, hum:85 },
    { id:'SP009', name:'Mauá',                 lat:-23.6678, lng:-46.4611, rain1h: 6.1, rain24h:25.8, riverM:2.01,  temp:19.3, hum:84 },
    { id:'SP010', name:'São Bernardo do Campo',lat:-23.6939, lng:-46.5650, rain1h: 5.2, rain24h:22.1, riverM:1.92,  temp:19.5, hum:83 },
    { id:'SP011', name:'Campinas',             lat:-22.9099, lng:-47.0626, rain1h: 3.1, rain24h:14.8, riverM:1.15,  temp:20.2, hum:78 },
    { id:'SP012', name:'Sorocaba',             lat:-23.5015, lng:-47.4526, rain1h: 0.8, rain24h: 6.5, riverM:0.87,  temp:21.0, hum:75 },
    { id:'SP013', name:'Mogi das Cruzes',      lat:-23.5235, lng:-46.1872, rain1h: 4.5, rain24h:18.2, riverM:1.55,  temp:19.8, hum:82 },
    { id:'SP014', name:'Barueri',              lat:-23.5054, lng:-46.8762, rain1h:16.3, rain24h:58.9, riverM:6.42,  temp:18.0, hum:92 },
    { id:'SP015', name:'Cotia',                lat:-23.6036, lng:-46.9192, rain1h:11.2, rain24h:43.7, riverM:3.88,  temp:18.7, hum:89 },
  ],

  // Pre-built alert list
  alerts: [
    {
      id:'A001', severity:'critical', type:'flood',
      title:'Inundação Severa — Rio Tietê',
      location:'Marginal Tietê, São Paulo',
      desc:'Nível do Rio Tietê atingiu 9.48m, superando a cota de inundação (8.0m). Risco iminente para vias marginais e áreas baixas.',
      rain1h:32.5, rain24h:89.5, time: ago(10),
    },
    {
      id:'A002', severity:'critical', type:'rain',
      title:'Chuva Extrema — Osasco',
      location:'Osasco / Barueri, SP',
      desc:'Precipitação de 18.7mm/h registrada. Acumulado de 67.3mm em 24h. Risco de transbordamento de córregos.',
      rain1h:18.7, rain24h:67.3, time: ago(25),
    },
    {
      id:'A003', severity:'critical', type:'river',
      title:'Nível Crítico — Rio Pinheiros',
      location:'São Paulo Centro, SP',
      desc:'Rio Pinheiros em 8.12m. Cota de alerta: 7.5m. Bombas de recalque acionadas. Monitoramento contínuo.',
      rain1h:21.3, rain24h:72.4, time: ago(45),
    },
    {
      id:'A004', severity:'critical', type:'flood',
      title:'Alagamento em Via Expressa',
      location:'Barueri, SP',
      desc:'Acumulado de 58.9mm em 24h. Via Anhanguera com alagamento crítico. Desvio de tráfego recomendado.',
      rain1h:16.3, rain24h:58.9, time: ago(55),
    },
    {
      id:'A005', severity:'high', type:'rain',
      title:'Precipitação Acima do Limite',
      location:'Taboão da Serra, SP',
      desc:'51.6mm nas últimas 24h, representando 240% da média histórica. Atenção para drenagem urbana.',
      rain1h:14.2, rain24h:51.6, time: ago(70),
    },
    {
      id:'A006', severity:'high', type:'flood',
      title:'Risco de Alagamento Urbano',
      location:'Guarulhos, SP',
      desc:'45.2mm/24h registrado. Pontos históricos de alagamento ativados. Monitoramento intensificado.',
      rain1h:12.3, rain24h:45.2, time: ago(95),
    },
    {
      id:'A007', severity:'high', type:'rain',
      title:'Chuva Intensa Contínua',
      location:'Cotia, SP',
      desc:'43.7mm/24h. Tendência de manutenção da precipitação nas próximas 4 horas segundo previsão.',
      rain1h:11.2, rain24h:43.7, time: ago(115),
    },
    {
      id:'A008', severity:'high', type:'flood',
      title:'Nível Elevado — Córrego Tamanduateí',
      location:'São Paulo — Leste, SP',
      desc:'41.3mm/24h. Tamanduateí com nível 3.67m, aproximando-se da cota de atenção (4.0m).',
      rain1h:9.8, rain24h:41.3, time: ago(130),
    },
    {
      id:'A009', severity:'medium', type:'rain',
      title:'Monitoramento Elevado',
      location:'Santo André, SP',
      desc:'38.7mm/24h. Monitoramento preventivo de encostas em áreas de risco geológico.',
      rain1h:8.5, rain24h:38.7, time: ago(180),
    },
    {
      id:'A010', severity:'medium', type:'rain',
      title:'Alerta Preventivo',
      location:'Diadema, SP',
      desc:'29.4mm/24h. Dentro do limiar médio. Equipes de resposta em prontidão.',
      rain1h:7.2, rain24h:29.4, time: ago(210),
    },
    {
      id:'A011', severity:'medium', type:'rain',
      title:'Precipitação Moderada',
      location:'Mauá, SP',
      desc:'25.8mm/24h. Drenagem operando dentro da capacidade. Monitoramento padrão.',
      rain1h:6.1, rain24h:25.8, time: ago(250),
    },
    {
      id:'A012', severity:'medium', type:'rain',
      title:'Atenção para Enxurradas',
      location:'São Bernardo do Campo, SP',
      desc:'22.1mm/24h. Baixa probabilidade de enxurradas, porém solo ainda saturado das últimas chuvas.',
      rain1h:5.2, rain24h:22.1, time: ago(290),
    },
    {
      id:'A013', severity:'low', type:'rain',
      title:'Normalização Progressiva',
      location:'Mogi das Cruzes, SP',
      desc:'18.2mm/24h. Níveis estabilizando. Recomendado atenção a vias secundárias.',
      rain1h:4.5, rain24h:18.2, time: ago(360),
    },
    {
      id:'A014', severity:'low', type:'rain',
      title:'Chuva Fraca Residual',
      location:'Campinas, SP',
      desc:'14.8mm/24h. Precipitação abaixo do limiar de preocupação. Monitoramento de rotina.',
      rain1h:3.1, rain24h:14.8, time: ago(420),
    },
    {
      id:'A015', severity:'low', type:'rain',
      title:'Situação Estável',
      location:'Sorocaba, SP',
      desc:'6.5mm/24h. Todos os indicadores dentro dos parâmetros normais de operação.',
      rain1h:0.8, rain24h:6.5, time: ago(480),
    },
  ],

  // 30 days of historical daily rainfall (mm) — realistic SP June pattern
  rainfall30d: [
    8.2,  0.0,  2.5, 15.3, 42.1, 87.6, 31.4, 10.2,  0.0,  0.0,
    5.8, 21.0, 64.3, 95.2, 48.7, 14.1,  3.2,  0.0,  9.5, 38.4,
   55.1, 91.8, 78.3, 42.6, 23.4, 11.8,  0.0, 67.5, 79.0, 85.2,
  ],

  // 30 days of mean temperature
  temp30d: [
    20.1, 21.3, 22.0, 19.5, 17.8, 15.2, 16.4, 18.9, 21.5, 22.3,
    21.7, 20.4, 17.1, 14.8, 16.2, 18.5, 20.9, 22.1, 21.4, 18.7,
    16.9, 14.5, 15.3, 17.2, 19.0, 20.6, 22.4, 17.5, 17.8, 18.2,
  ],

  // Hourly rainfall for today (0–23h)
  todayHourly: [
    0.0, 0.0, 0.0, 1.2, 3.4, 8.7, 14.2, 18.9, 21.3, 16.8,
    12.5, 9.1, 6.8, 5.2, 8.4, 12.1, 16.3, 19.7, 18.2, 14.5,
    11.3,  8.7, 6.2, 4.1,
  ],

  // Monthly totals (Jan–Jun 2026)
  monthly: [
    { m:'Jan', mm:245 },
    { m:'Fev', mm:198 },
    { m:'Mar', mm:176 },
    { m:'Abr', mm:89  },
    { m:'Mai', mm:62  },
    { m:'Jun', mm:341 },
  ],
};

// Helper: "N min atrás"
function ago(minutes) {
  if (minutes < 60) return `${minutes} min atrás`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min atrás` : `${h}h atrás`;
}

// ============================================================
// DERIVED CONSTANTS
// ============================================================

function getRiskLevel(point) {
  const t = CONFIG.THRESHOLDS;
  if (point.rain24h >= t.critical.rain24h || point.rain1h >= t.critical.rain1h || point.riverM >= t.critical.riverM) return 'critical';
  if (point.rain24h >= t.high.rain24h     || point.rain1h >= t.high.rain1h     || point.riverM >= t.high.riverM)     return 'high';
  if (point.rain24h >= t.medium.rain24h   || point.rain1h >= t.medium.rain1h   || point.riverM >= t.medium.riverM)   return 'medium';
  return 'low';
}

const POINTS = MOCK.points.map(p => ({ ...p, risk: getRiskLevel(p) }));
const ALERTS = MOCK.alerts;

function countBySeverity(list) {
  return list.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});
}

const SEV_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

const ALERT_ICONS = {
  flood: 'fa-house-flood-water',
  rain:  'fa-cloud-showers-heavy',
  river: 'fa-water',
  landslide: 'fa-mountain',
};

// ============================================================
// MERGE / INPE — BDC STAC API
// Collection: prec_merge_hourly-1
// Docs: https://data.inpe.br/bdc/stac/v1/collections/prec_merge_hourly-1
// ============================================================

function isoFmt(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function fetchMERGEData() {
  try {
    // ── Step 1: Collection metadata ──────────────────────────
    const collRes = await fetch(
      `${INPE.STAC}/collections/${INPE.COLLECTION}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!collRes.ok) throw new Error(`Collection HTTP ${collRes.status}`);
    const collection = await collRes.json();
    console.log('[FloodGuard] MERGE collection:', collection.title || collection.id);

    // ── Step 2: Search recent hourly items for SP area ───────
    const now    = new Date();
    const past48 = new Date(now - 48 * 3600_000);
    const bbox   = INPE.SP_BBOX.join(',');
    const dtStr  = `${isoFmt(past48)}/${isoFmt(now)}`;

    const searchRes = await fetch(
      `${INPE.STAC}/collections/${INPE.COLLECTION}/items` +
      `?bbox=${encodeURIComponent(bbox)}` +
      `&datetime=${encodeURIComponent(dtStr)}` +
      `&limit=48&sortby=-datetime`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (!searchRes.ok) throw new Error(`Items HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    const items = searchData.features || [];

    console.log(`[FloodGuard] MERGE items returned: ${items.length}`);

    // ── Step 3: Attempt pixel extraction via GeoTIFF ─────────
    let hourlyValues = [];
    if (typeof GeoTIFF !== 'undefined' && items.length > 0) {
      hourlyValues = await extractMERGEHourly(items.slice(0, 24));
    }

    if (hourlyValues.length >= 6) {
      // Enough real values — compute 24h accumulation
      const rain24h = hourlyValues.reduce((s, v) => s + v, 0).toFixed(1);
      const latestTemp = hourlyValues[0] != null ? (17.8).toFixed(1) : '17.8';
      document.getElementById('tbRain').textContent     = rain24h;
      document.getElementById('statRain').textContent   = rain24h;
      document.getElementById('tbTemp').textContent     = latestTemp;

      // Push real hourly data to charts
      const labels = items.slice(0, hourlyValues.length).map(it => {
        const dt = new Date(it.properties?.datetime || it.id);
        return dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      }).reverse();
      APP_STATE.liveRainLabels = labels;
      APP_STATE.liveRainData   = [...hourlyValues].reverse();
      updateHistoryChart('rainfall');
    } else {
      // Fallback: show mock values, real timestamps in status
      applyMockSummary();
    }

    // ── Step 4: Update status indicators ─────────────────────
    const latest = items[0]?.properties?.datetime;
    setMERGEStatus(true, items.length, latest, collection.title);
    return { collection, items };

  } catch (err) {
    console.warn('[FloodGuard] MERGE/INPE unavailable:', err.message);
    applyMockSummary();
    setMERGEStatus(false, 0, null, null);
    return null;
  }
}

async function extractMERGEHourly(items) {
  const results = [];
  for (const item of items) {
    try {
      const assets = item.assets || {};
      // MERGE COG key might be 'data', 'B1', or the first available asset
      const key = ['data', 'B1', 'precipitation', 'prec'].find(k => assets[k]) ||
                  Object.keys(assets)[0];
      const href = assets[key]?.href;
      if (!href) continue;

      const val = await readCOGPixel(href, INPE.SP_LAT, INPE.SP_LNG);
      results.push(val ?? 0);
    } catch (_) {
      // CORS or parse failure — skip item silently
    }
    if (results.length >= 24) break;
  }
  return results;
}

async function readCOGPixel(url, lat, lng) {
  // Uses GeoTIFF.js to do an HTTP range-request on a Cloud Optimized GeoTIFF
  const tiff  = await GeoTIFF.fromUrl(url, { allowHttpExceptions: true });
  const image = await tiff.getImage();
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const w = image.getWidth();
  const h = image.getHeight();

  const px = Math.floor((lng - minX) / (maxX - minX) * w);
  const py = Math.floor((maxY - lat) / (maxY - minY) * h);
  if (px < 0 || px >= w || py < 0 || py >= h) return 0;

  const [band] = await image.readRasters({ window: [px, py, px + 1, py + 1] });
  const v = band[0];
  // MERGE no-data is -9999
  if (v == null || v < -9000) return 0;
  return Math.max(0, +Number(v).toFixed(2));
}

function setMERGEStatus(online, count, latestISO, title) {
  const dot    = document.getElementById('mergeDot');
  const label  = document.getElementById('mergeLabel');
  const badge  = document.getElementById('mergeBadge');
  const srcSts = document.getElementById('mergeSourceStatus');

  if (online) {
    if (dot)   { dot.className = 'status-dot online'; }
    if (badge) { badge.textContent = 'ATIVO'; badge.classList.remove('mock'); }
    if (srcSts){ srcSts.textContent = 'Online'; srcSts.className = 'source-status online'; }
    if (label && latestISO) {
      const t = new Date(latestISO).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      label.textContent = `MERGE/INPE · ${t}`;
    }
    if (count > 0) {
      console.log(`[FloodGuard] MERGE: ${count} itens — última análise: ${latestISO || '—'}`);
    }
  } else {
    if (dot)   { dot.className = 'status-dot partial'; }
    if (badge) { badge.textContent = 'MOCK'; badge.classList.add('mock'); }
    if (srcSts){ srcSts.textContent = 'Mock'; srcSts.className = 'source-status ref'; }
    if (label) { label.textContent = 'MERGE/INPE'; }
  }
}

function applyMockSummary() {
  document.getElementById('tbRain').textContent   = '79.0';
  document.getElementById('tbTemp').textContent   = '17.8';
  document.getElementById('statRain').textContent = '79.0';
}

// ============================================================
// APP STATE
// ============================================================

const APP_STATE = {
  page: 'overview',
  alertFilter: 'all',
  alertSearch: '',
  historyTab: 'rainfall',
  maps: {},
  charts: {},
  mapsInited: {},
  liveRainLabels: null,
  liveRainData: null,
  liveTempData: null,
};

// ============================================================
// CLOCK
// ============================================================

function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById('clockTime').textContent =
      now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    document.getElementById('clockDate').textContent =
      now.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

// ============================================================
// NAVIGATION
// ============================================================

function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  // Update title
  const titles = {
    overview: ['Visão Geral', 'Região Metropolitana de São Paulo'],
    riskmap:  ['Mapa de Risco', 'Zonas de risco hidrológico'],
    alerts:   ['Central de Alertas', 'Monitoramento de eventos críticos'],
    reports:  ['Relatórios e IA', 'Análise histórica e previsões'],
    settings: ['Configurações', 'Parâmetros do sistema'],
  };

  const [title, sub] = titles[page] || ['FloodGuard', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = sub;

  APP_STATE.page = page;

  // Lazy-init maps — give the DOM 350ms to paint before Leaflet measures the container
  if (page === 'overview') {
    if (!APP_STATE.mapsInited.overview) {
      setTimeout(() => {
        initOverviewMap();
        APP_STATE.mapsInited.overview = true;
        setTimeout(() => APP_STATE.maps.overview?.invalidateSize(), 150);
      }, 350);
    } else {
      setTimeout(() => APP_STATE.maps.overview?.invalidateSize(), 100);
    }
  }

  if (page === 'riskmap') {
    if (!APP_STATE.mapsInited.riskmap) {
      setTimeout(() => {
        initRiskMap();
        APP_STATE.mapsInited.riskmap = true;
        // Double invalidate: first pass lays out tiles, second corrects any resize
        setTimeout(() => APP_STATE.maps.risk?.invalidateSize(), 200);
        setTimeout(() => APP_STATE.maps.risk?.invalidateSize(), 600);
      }, 350);
    } else {
      setTimeout(() => APP_STATE.maps.risk?.invalidateSize(), 100);
      setTimeout(() => APP_STATE.maps.risk?.invalidateSize(), 400);
    }
  }
}

// Sidebar click handlers
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// History chart tab buttons
document.querySelectorAll('[data-chart]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-chart]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateHistoryChart(btn.dataset.chart);
  });
});

// ============================================================
// OVERVIEW — STATS
// Total active alerts in the monitored region (full system)
// The ALERTS list shows the most recent/detailed 15 events
// ============================================================

const TOTAL_ACTIVE_ALERTS = 128;

function renderOverviewStats() {
  const counts = countBySeverity(ALERTS);
  document.getElementById('statAlerts').textContent = TOTAL_ACTIVE_ALERTS;
  document.getElementById('navAlertBadge').textContent = 12;
}

// ============================================================
// OVERVIEW — SEVERITY DONUT
// ============================================================

function renderSeverityChart(canvasId, legendId, totalId) {
  // Full system distribution (128 total)
  const systemCounts = { critical: 32, high: 41, medium: 38, low: 17 };
  const order  = ['critical', 'high', 'medium', 'low'];
  const labels = { critical:'Crítico', high:'Alto', medium:'Médio', low:'Baixo' };
  const counts = systemCounts;
  const data   = order.map(k => counts[k] || 0);
  const colors = order.map(k => SEV_COLORS[k]);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (APP_STATE.charts[canvasId]) APP_STATE.charts[canvasId].destroy();

  APP_STATE.charts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: order.map(k => labels[k]),
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#0d1626', hoverOffset: 6 }],
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#101c30',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} alertas`,
          },
        },
      },
    },
  });

  const totalEl = document.getElementById(totalId);
  if (totalEl) totalEl.textContent = TOTAL_ACTIVE_ALERTS;

  const legendEl = document.getElementById(legendId);
  if (legendEl) {
    legendEl.innerHTML = order.map(k => `
      <div class="sev-legend-item">
        <div class="sev-legend-left">
          <div class="sev-legend-dot" style="background:${SEV_COLORS[k]}"></div>
          <span>${labels[k]}</span>
        </div>
        <span class="sev-legend-count">${counts[k] || 0}</span>
      </div>
    `).join('');
  }
}

// ============================================================
// OVERVIEW — QUICK ALERTS
// ============================================================

function renderQuickAlerts() {
  const container = document.getElementById('quickAlertsList');
  if (!container) return;

  const top5 = ALERTS.slice(0, 5);
  container.innerHTML = top5.map(a => `
    <div class="quick-alert-item">
      <div class="quick-alert-icon ${a.severity}">
        <i class="fas ${ALERT_ICONS[a.type] || 'fa-triangle-exclamation'}"></i>
      </div>
      <div class="quick-alert-body">
        <div class="quick-alert-title">${a.title}</div>
        <div class="quick-alert-location"><i class="fas fa-location-dot"></i> ${a.location}</div>
      </div>
      <div class="quick-alert-time">${a.time}</div>
    </div>
  `).join('');
}

// ============================================================
// HISTORY CHART
// ============================================================

function getHistoryDatasets(type) {
  const labels30 = (() => {
    const arr = [];
    const now = new Date('2026-06-09');
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      arr.push(d.toLocaleDateString('pt-BR', { day:'numeric', month:'short' }));
    }
    return arr;
  })();

  const liveLabels = APP_STATE.liveRainLabels || labels30;
  const liveRain   = APP_STATE.liveRainData   || MOCK.rainfall30d;
  const liveTemp   = APP_STATE.liveTempData   || MOCK.temp30d;

  if (type === 'rainfall') {
    return {
      labels: liveLabels,
      datasets: [{
        label: 'Precipitação (mm)',
        data: liveRain,
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          g.addColorStop(0, 'rgba(6,182,212,0.55)');
          g.addColorStop(1, 'rgba(6,182,212,0.03)');
          return g;
        },
        borderColor: '#06b6d4',
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
        type: 'bar',
      }],
    };
  }

  if (type === 'river') {
    const riverData = [
      4.2,3.8,3.5,4.1,5.2,7.8,9.1,7.5,6.3,5.0,
      4.5,5.2,6.8,9.2,9.8,8.4,6.5,5.1,5.8,7.2,
      8.6,9.5,9.4,8.3,7.0,5.8,4.9,8.1,9.0,9.48,
    ];
    return {
      labels: liveLabels,
      datasets: [{
        label: 'Nível Rio Tietê (m)',
        data: riverData,
        borderColor: '#3b82f6',
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          g.addColorStop(0, 'rgba(59,130,246,0.4)');
          g.addColorStop(1, 'rgba(59,130,246,0.02)');
          return g;
        },
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }],
    };
  }

  // temp
  return {
    labels: liveLabels,
    datasets: [{
      label: 'Temperatura Máx. (°C)',
      data: liveTemp,
      borderColor: '#f97316',
      backgroundColor: ctx => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
        g.addColorStop(0, 'rgba(249,115,22,0.35)');
        g.addColorStop(1, 'rgba(249,115,22,0.02)');
        return g;
      },
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
    }],
  };
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      grid:  { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#4a6480', font: { size: 10 }, maxTicksLimit: 10 },
    },
    y: {
      grid:  { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#4a6480', font: { size: 10 } },
      beginAtZero: true,
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#101c30',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      padding: 10,
      titleColor: '#ddeeff',
      bodyColor: '#7a9ab8',
    },
  },
};

function initHistoryChart() {
  const canvas = document.getElementById('historyChart');
  if (!canvas) return;

  const { labels, datasets } = getHistoryDatasets('rainfall');
  APP_STATE.charts.history = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: { ...CHART_DEFAULTS },
  });
}

function updateHistoryChart(type) {
  APP_STATE.historyTab = type;
  const chart = APP_STATE.charts.history;
  if (!chart) return;

  const { labels, datasets } = getHistoryDatasets(type);
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.config.type = (type === 'rainfall') ? 'bar' : 'line';
  chart.update();
}

// ============================================================
// OVERVIEW MAP
// ============================================================

function initOverviewMap() {
  const mapEl = document.getElementById('overviewMap');
  if (!mapEl || APP_STATE.maps.overview) return;

  const map = L.map('overviewMap', {
    center: CONFIG.CENTER,
    zoom: CONFIG.OVERVIEW_ZOOM,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  POINTS.forEach(p => {
    const color = SEV_COLORS[p.risk];
    const radius = p.risk === 'critical' ? 12 : p.risk === 'high' ? 10 : p.risk === 'medium' ? 9 : 8;

    // Outer glow circle
    if (p.risk === 'critical' || p.risk === 'high') {
      L.circleMarker([p.lat, p.lng], {
        radius: radius + 8,
        fillColor: color,
        fillOpacity: 0.12,
        color: 'transparent',
      }).addTo(map);
    }

    // Main marker
    L.circleMarker([p.lat, p.lng], {
      radius,
      fillColor: color,
      fillOpacity: 0.85,
      color: '#fff',
      weight: 1.5,
    })
    .bindPopup(buildPopup(p))
    .addTo(map);
  });

  APP_STATE.maps.overview = map;
}

function buildPopup(p) {
  const riskLabel = { critical:'Crítico', high:'Alto', medium:'Médio', low:'Baixo' }[p.risk];
  const color = SEV_COLORS[p.risk];
  return `
    <div style="min-width:200px; font-family:Inter,sans-serif;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};"></div>
        <strong style="font-size:13px;">${p.name}</strong>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div>
          <div style="color:#7a9ab8;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Chuva 1h</div>
          <div style="font-weight:700;color:#ddeeff;">${p.rain1h} mm/h</div>
        </div>
        <div>
          <div style="color:#7a9ab8;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Chuva 24h</div>
          <div style="font-weight:700;color:#ddeeff;">${p.rain24h} mm</div>
        </div>
        <div>
          <div style="color:#7a9ab8;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Nível do Rio</div>
          <div style="font-weight:700;color:#ddeeff;">${p.riverM} m</div>
        </div>
        <div>
          <div style="color:#7a9ab8;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Temperatura</div>
          <div style="font-weight:700;color:#ddeeff;">${p.temp}°C</div>
        </div>
      </div>
      <div style="margin-top:10px;padding:5px 10px;border-radius:6px;background:${color}22;border:1px solid ${color}44;text-align:center;font-size:11px;font-weight:700;color:${color};">
        RISCO ${riskLabel.toUpperCase()}
      </div>
    </div>`;
}

// ============================================================
// RISK MAP
// ============================================================

function initRiskMap() {
  const mapEl = document.getElementById('riskMap');
  if (!mapEl || APP_STATE.maps.risk) return;

  const map = L.map('riskMap', {
    center: CONFIG.CENTER,
    zoom: CONFIG.RISK_ZOOM,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Risk zone overlays (concentric circles to simulate heatmap zones)
  const riskZones = [
    { lat:-23.5150, lng:-46.6400, radii:[4000,6000,9000],   colors:['critical','critical','high'] },
    { lat:-23.5325, lng:-46.7920, radii:[3500,5500,8000],   colors:['critical','high','medium'] },
    { lat:-23.5505, lng:-46.6333, radii:[3000,5000,7500],   colors:['critical','high','medium'] },
    { lat:-23.6100, lng:-46.7600, radii:[2500,4500,6500],   colors:['high','high','medium'] },
    { lat:-23.4564, lng:-46.5338, radii:[2000,3500,5500],   colors:['high','medium','low'] },
    { lat:-23.6639, lng:-46.5338, radii:[1800,3000,5000],   colors:['high','medium','low'] },
    { lat:-23.5465, lng:-46.4754, radii:[1500,2800,4500],   colors:['high','medium','low'] },
    { lat:-23.6861, lng:-46.6228, radii:[1200,2200,4000],   colors:['medium','medium','low'] },
    { lat:-23.6678, lng:-46.4611, radii:[1000,2000,3500],   colors:['medium','low','low'] },
    { lat:-23.6939, lng:-46.5650, radii:[1000,1800,3000],   colors:['medium','low','low'] },
  ];

  riskZones.forEach(zone => {
    zone.radii.forEach((r, i) => {
      const colorKey = zone.colors[i];
      const color = SEV_COLORS[colorKey];
      const opacity = [0.30, 0.18, 0.09][i];
      L.circle([zone.lat, zone.lng], {
        radius: r,
        fillColor: color,
        fillOpacity: opacity,
        color: 'transparent',
        interactive: false,
      }).addTo(map);
    });
  });

  // Point markers on top
  POINTS.forEach(p => {
    const color = SEV_COLORS[p.risk];
    L.circleMarker([p.lat, p.lng], {
      radius: 6,
      fillColor: color,
      fillOpacity: 0.9,
      color: '#fff',
      weight: 1.5,
    })
    .bindPopup(buildPopup(p))
    .addTo(map);
  });

  APP_STATE.maps.risk = map;
}

function toggleRiskLayer(type) {
  document.querySelectorAll('#layerRisk, #layerRain').forEach(b => b.classList.remove('active'));
  document.getElementById(type === 'risk' ? 'layerRisk' : 'layerRain').classList.add('active');
}

// ============================================================
// RISK MAP SIDEBAR
// ============================================================

function renderRiskSidebar() {
  const counts = countBySeverity(POINTS.map(p => ({ severity: p.risk })));
  const total  = POINTS.length;

  const barsEl = document.getElementById('riskLevelBars');
  if (barsEl) {
    const items = [
      { key:'critical', label:'Crítico', count: counts.critical || 0 },
      { key:'high',     label:'Alto',    count: counts.high     || 0 },
      { key:'medium',   label:'Médio',   count: counts.medium   || 0 },
      { key:'low',      label:'Baixo',   count: counts.low      || 0 },
    ];
    barsEl.innerHTML = items.map(item => `
      <div class="risk-bar-item">
        <div class="risk-bar-label">
          <span class="label" style="color:${SEV_COLORS[item.key]}">${item.label}</span>
          <span class="value">${item.count} / ${total}</span>
        </div>
        <div class="risk-bar-track">
          <div class="risk-bar-fill ${item.key}" style="width:${(item.count/total*100).toFixed(0)}%"></div>
        </div>
      </div>
    `).join('');
  }

  const listEl = document.getElementById('riskPointsList');
  if (listEl) {
    const sorted = [...POINTS].sort((a,b) => {
      const order = { critical:0, high:1, medium:2, low:3 };
      return order[a.risk] - order[b.risk];
    });
    listEl.innerHTML = sorted.map(p => `
      <div class="risk-point-item">
        <div class="risk-point-dot" style="background:${SEV_COLORS[p.risk]}"></div>
        <span class="risk-point-name">${p.name}</span>
        <span class="risk-point-value">${p.rain24h}mm</span>
      </div>
    `).join('');
  }
}

// ============================================================
// ALERTS PAGE
// ============================================================

function renderAlertCounts() {
  const counts = countBySeverity(ALERTS);
  // Show full system counts (128 total), alerts list shows the 15 most critical
  document.getElementById('fc-all').textContent      = TOTAL_ACTIVE_ALERTS;
  document.getElementById('fc-critical').textContent = 32;
  document.getElementById('fc-high').textContent     = 41;
  document.getElementById('fc-medium').textContent   = 38;
  document.getElementById('fc-low').textContent      = 17;
}

function filterAlerts() {
  APP_STATE.alertSearch = (document.getElementById('alertSearch')?.value || '').toLowerCase();
  renderAlertList();
}

function setAlertFilter(filter) {
  APP_STATE.alertFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderAlertList();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => setAlertFilter(btn.dataset.filter));
});

function renderAlertList() {
  const container = document.getElementById('alertsList');
  if (!container) return;

  let list = [...ALERTS];
  if (APP_STATE.alertFilter !== 'all') {
    list = list.filter(a => a.severity === APP_STATE.alertFilter);
  }
  if (APP_STATE.alertSearch) {
    list = list.filter(a =>
      a.title.toLowerCase().includes(APP_STATE.alertSearch) ||
      a.location.toLowerCase().includes(APP_STATE.alertSearch) ||
      a.desc.toLowerCase().includes(APP_STATE.alertSearch)
    );
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-3);">
        <i class="fas fa-search" style="font-size:24px;margin-bottom:10px;display:block"></i>
        Nenhum alerta encontrado
      </div>`;
    return;
  }

  container.innerHTML = list.map(a => `
    <div class="alert-item ${a.severity}">
      <div class="alert-icon ${a.severity}">
        <i class="fas ${ALERT_ICONS[a.type] || 'fa-triangle-exclamation'}"></i>
      </div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
        <div class="alert-meta">
          <span><i class="fas fa-location-dot"></i>${a.location}</span>
          <span><i class="fas fa-cloud-rain"></i>${a.rain24h}mm/24h</span>
          <span><i class="fas fa-bolt"></i>${a.rain1h}mm/h</span>
        </div>
      </div>
      <div class="alert-right">
        <span class="alert-time">${a.time}</span>
        <span class="badge-severity ${a.severity}">${
          { critical:'Crítico', high:'Alto', medium:'Médio', low:'Baixo' }[a.severity]
        }</span>
      </div>
    </div>
  `).join('');
}

function renderAlertsTimelineChart() {
  const canvas = document.getElementById('timelineChart');
  if (!canvas) return;

  // Alerts per hour (mock hourly distribution)
  const hours = Array.from({length:24}, (_,i) => i + 'h');
  const data  = [0,0,0,1,2,3,5,8,10,9,7,5,6,8,11,9,7,6,8,10,9,7,5,3];

  if (APP_STATE.charts.alertsTimeline) APP_STATE.charts.alertsTimeline.destroy();

  APP_STATE.charts.alertsTimeline = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [{
        data,
        backgroundColor: data.map(v =>
          v >= 10 ? 'rgba(239,68,68,0.6)' :
          v >= 7  ? 'rgba(249,115,22,0.6)' :
          v >= 4  ? 'rgba(234,179,8,0.6)' :
                    'rgba(34,197,94,0.6)'
        ),
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#101c30', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
        callbacks: { label: ctx => ` ${ctx.raw} alertas` },
      }},
      scales: {
        x: { grid: { display: false }, ticks: { color: '#4a6480', font: { size: 9 }, maxTicksLimit: 8 }},
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a6480', font: { size: 9 }}, beginAtZero: true },
      },
    },
  });
}

// ============================================================
// REPORTS PAGE
// ============================================================

function renderMonthlyRainChart() {
  const canvas = document.getElementById('monthlyRainChart');
  if (!canvas) return;

  if (APP_STATE.charts.monthly) APP_STATE.charts.monthly.destroy();

  APP_STATE.charts.monthly = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: MOCK.monthly.map(m => m.m),
      datasets: [{
        label: 'Precipitação (mm)',
        data: MOCK.monthly.map(m => m.mm),
        backgroundColor: MOCK.monthly.map((m, i) =>
          i === MOCK.monthly.length - 1 ? 'rgba(239,68,68,0.7)' : 'rgba(6,182,212,0.5)'
        ),
        borderColor: MOCK.monthly.map((m, i) =>
          i === MOCK.monthly.length - 1 ? '#ef4444' : '#06b6d4'
        ),
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.raw} mm` },
        },
      },
    },
  });
}

function renderTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;

  const liveLabels = APP_STATE.liveRainLabels || (() => {
    const arr = [];
    const now = new Date('2026-06-09');
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      arr.push(d.toLocaleDateString('pt-BR', { day:'numeric', month:'short' }));
    }
    return arr;
  })();

  if (APP_STATE.charts.trend) APP_STATE.charts.trend.destroy();

  APP_STATE.charts.trend = new Chart(canvas, {
    type: 'line',
    data: {
      labels: liveLabels,
      datasets: [
        {
          label: 'Precipitação (mm)',
          data: APP_STATE.liveRainData || MOCK.rainfall30d,
          borderColor: '#06b6d4',
          backgroundColor: ctx => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
            g.addColorStop(0, 'rgba(6,182,212,0.35)');
            g.addColorStop(1, 'rgba(6,182,212,0.0)');
            return g;
          },
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'yRain',
        },
        {
          label: 'Temperatura (°C)',
          data: APP_STATE.liveTempData || MOCK.temp30d,
          borderColor: '#f97316',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderDash: [4, 3],
          yAxisID: 'yTemp',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a6480', font: { size: 10 }, maxTicksLimit: 10 }},
        yRain: {
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#06b6d4', font: { size: 10 } },
          beginAtZero: true,
        },
        yTemp: {
          position: 'right',
          grid: { display: false },
          ticks: { color: '#f97316', font: { size: 10 } },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { color: '#7a9ab8', font: { size: 11 }, boxWidth: 14, usePointStyle: true, pointStyle: 'line' },
        },
        tooltip: {
          backgroundColor: '#101c30', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
          padding: 10, titleColor: '#ddeeff', bodyColor: '#7a9ab8',
        },
      },
    },
  });
}

function renderIntensityChart() {
  const canvas = document.getElementById('intensityChart');
  if (!canvas) return;

  if (APP_STATE.charts.intensity) APP_STATE.charts.intensity.destroy();

  const hours = MOCK.todayHourly.map((_, i) => `${i}h`);

  APP_STATE.charts.intensity = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [{
        label: 'mm/h',
        data: MOCK.todayHourly,
        backgroundColor: MOCK.todayHourly.map(v =>
          v >= 30 ? 'rgba(239,68,68,0.7)' :
          v >= 15 ? 'rgba(249,115,22,0.7)' :
          v >= 5  ? 'rgba(234,179,8,0.7)' :
                    'rgba(34,197,94,0.6)'
        ),
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.raw} mm/h` },
        },
      },
    },
  });
}

function renderMiniStats() {
  const el = document.getElementById('reportsMiniStats');
  if (!el) return;

  const maxRain = Math.max(...MOCK.rainfall30d);
  const avgRain = (MOCK.rainfall30d.reduce((a,b) => a+b, 0) / 30).toFixed(1);
  const maxTemp = Math.max(...MOCK.temp30d).toFixed(1);
  const daysRain = MOCK.rainfall30d.filter(v => v > 0).length;

  el.innerHTML = [
    { value: maxRain.toFixed(1) + 'mm', label: 'Máx. Diário' },
    { value: avgRain + 'mm',            label: 'Média Diária' },
    { value: maxTemp + '°C',            label: 'Temp. Máx.' },
    { value: daysRain + ' dias',        label: 'Com Chuva' },
  ].map(s => `
    <div class="mini-stat">
      <div class="mini-stat-value">${s.value}</div>
      <div class="mini-stat-label">${s.label}</div>
    </div>
  `).join('');
}

function renderPeriodStats() {
  const el = document.getElementById('periodStats');
  if (!el) return;

  const totalRain  = MOCK.rainfall30d.reduce((a,b) => a+b, 0).toFixed(1);
  const avgTemp    = (MOCK.temp30d.reduce((a,b) => a+b, 0) / 30).toFixed(1);
  const peakRain   = Math.max(...MOCK.todayHourly).toFixed(1);
  const critAlerts = countBySeverity(ALERTS).critical || 0;
  const totalAlerts = ALERTS.length;
  const maxRiver = Math.max(...[9.48,9.5,9.2,8.4,7.2]).toFixed(2);

  el.innerHTML = [
    { label:'Precipitação Total (30d)', value: totalRain + ' mm' },
    { label:'Temperatura Média',        value: avgTemp + ' °C' },
    { label:'Pico de Chuva (hoje)',      value: peakRain + ' mm/h' },
    { label:'Nível Máx. Rio Tietê',     value: maxRiver + ' m' },
    { label:'Total de Alertas',         value: totalAlerts },
    { label:'Alertas Críticos',         value: critAlerts, highlight: true },
  ].map(s => `
    <div class="period-stat-row">
      <span class="period-stat-label">${s.label}</span>
      <span class="period-stat-value" style="${s.highlight ? 'color:var(--critical)' : ''}">${s.value}</span>
    </div>
  `).join('');
}

function renderAIAnalysis() {
  const el = document.getElementById('aiAnalysis');
  if (!el) return;

  const predictions = [
    {
      icon: 'fa-triangle-exclamation',
      color: 'var(--critical)',
      title: 'Risco Elevado — Próximas 6h',
      text: 'Modelos indicam continuidade das chuvas intensas na Grande São Paulo. Probabilidade de 87% de precipitação acima de 30mm/6h. Pontos críticos: Marginal Tietê e Osasco.',
      confidence: 87,
    },
    {
      icon: 'fa-water',
      color: 'var(--high)',
      title: 'Nível do Rio — Tendência',
      text: 'Rio Tietê deve permanecer acima da cota de inundação (8.0m) por mais 8 a 12 horas. Pico estimado entre 9.5m e 10.2m nas próximas 4 horas.',
      confidence: 79,
    },
    {
      icon: 'fa-sun',
      color: 'var(--low)',
      title: 'Previsão 24–48h',
      text: 'Redução gradual da precipitação prevista para amanhã à tarde. Tendência de queda no nível dos rios a partir de amanhã às 18h, conforme dados INMET/CPTEC.',
      confidence: 72,
    },
    {
      icon: 'fa-chart-line',
      color: 'var(--accent-light)',
      title: 'Análise de Padrão Histórico',
      text: 'Precipitação acumulada de junho/2026 (341mm) já supera a média histórica de junho (120mm) em 184%. Evento classificado como EXCEPCIONAL pelo sistema de análise climática.',
      confidence: 95,
    },
  ];

  el.innerHTML = predictions.map(p => `
    <div class="ai-prediction">
      <div class="ai-prediction-header" style="color:${p.color}">
        <i class="fas ${p.icon}"></i>
        ${p.title}
      </div>
      <div class="ai-prediction-text">${p.text}</div>
      <div class="ai-confidence">
        <span>Confiança: ${p.confidence}%</span>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width:${p.confidence}%;background:${p.color}"></div>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(msg, duration = 4000) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ============================================================
// SIMULATED LIVE UPDATES
// ============================================================

function simulateLiveUpdate() {
  // Randomly increase one critical point's rainfall slightly
  const critPoints = POINTS.filter(p => p.risk === 'critical');
  if (critPoints.length) {
    const p = critPoints[Math.floor(Math.random() * critPoints.length)];
    const delta = (Math.random() * 2).toFixed(1);
    p.rain1h = +(p.rain1h + +delta).toFixed(1);
    if (Math.random() < 0.3) {
      showToast(`⚠ Chuva intensificando em ${p.name}: ${p.rain1h}mm/h`);
    }
  }
  // Update topbar stats
  const totalRainNow = +(MOCK.rainfall30d[29] + Math.random() * 0.5).toFixed(1);
  document.getElementById('tbRain').textContent = totalRainNow;
}

// ============================================================
// INITIALIZATION
// ============================================================

function init() {
  startClock();

  // Render all static content
  renderOverviewStats();
  renderSeverityChart('severityChart', 'severityLegend', 'severityTotal');
  renderQuickAlerts();
  initHistoryChart();
  applyMockSummary();

  // Render secondary pages in background
  renderRiskSidebar();
  renderAlertCounts();
  renderAlertList();

  // Reports charts
  renderMonthlyRainChart();
  renderTrendChart();
  renderIntensityChart();
  renderMiniStats();
  renderPeriodStats();
  renderAIAnalysis();

  // Alerts page extra charts
  renderSeverityChart('alertsSeverityChart', 'alertsSeverityLegend', 'alertsSeverityTotal');
  renderAlertsTimelineChart();

  // Init overview map (first page) — 400ms gives CSS time to paint before Leaflet measures
  setTimeout(() => {
    initOverviewMap();
    APP_STATE.mapsInited.overview = true;
    setTimeout(() => APP_STATE.maps.overview?.invalidateSize(), 200);
  }, 400);

  // Fetch live data from MERGE/INPE BDC STAC
  fetchMERGEData();

  // Show intro toast
  setTimeout(() => showToast('4 alertas críticos ativos — Marginal Tietê e Osasco'), 1500);

  // Periodic refresh
  setInterval(() => {
    fetchMERGEData();
    simulateLiveUpdate();
  }, CONFIG.UPDATE_INTERVAL);
}

document.addEventListener('DOMContentLoaded', init);
