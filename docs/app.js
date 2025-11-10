// === ARCHIVOS ===
const DEPTOS_URL = 'Departamentos.geojson';
const MUNI_URL_TEMPLATE = (code) => `Municipios_${code}.geojson`;
const COLEGIOS_URL_TEMPLATE = (code) => `Colegios_${code}.geojson`;  // NUEVO

// === CAMPOS ===
const DEPT_CODE_FIELD = 'DeCodigo';
const DEPT_NAME_FIELD = 'DeNombre';
const MUNI_DEPT_CODE_FIELD = 'DeCodigo';
const MUNI_NAME_FIELD = 'MpNombre';
const COLEGIO_NAME_FIELD = 'NOMBRE_INS';  // Ajusta si el campo es diferente (ej: 'NOMBRE', 'nombre_colegio')

// === CONFIG ===
const MAX_ZOOM_ON_FOCUS = 10;

// === UTILIDADES ===
const normalize = (s) =>
  (s ?? '').toString().trim();

const pickFirstProp = (obj, fields) => {
  if (!obj) return undefined;
  for (const f of fields) {
    if (obj[f] != null && obj[f] !== '') return obj[f];
  }
  return undefined;
};

// === CLAVES ===
const getDeptKey = (feature) => {
  const code = pickFirstProp(feature.properties, [DEPT_CODE_FIELD]);
  return code != null ? String(code).trim() : null;
};

const getDeptName = (feature) => {
  return pickFirstProp(feature.properties, [DEPT_NAME_FIELD]) ?? 'Departamento';
};

const getMunName = (feature) => {
  return pickFirstProp(feature.properties, [MUNI_NAME_FIELD, 'nombre', 'NOMBRE']) ?? 'Municipio';
};

const getColegioName = (feature) => {
  return pickFirstProp(feature.properties, [COLEGIO_NAME_FIELD, 'nombre', 'NOMBRE', 'Colegio']) ?? 'Colegio';
};

// === ESTILOS ===
const deptDefaultStyle = () => ({
  color: '#007d6e',
  weight: 1,
  fillColor: '#4dd0b3',
  fillOpacity: 0.25
});

const deptDimmedStyle = () => ({
  color: '#007d6e',
  weight: 1,
  fillColor: '#4dd0b3',
  fillOpacity: 0.06
});

const deptHighlightStyle = () => ({
  color: '#003d38',
  weight: 2,
  fillColor: '#a8ead9',
  fillOpacity: 0.35
});

const muniStyle = () => ({
  color: '#4b9d2a',
  weight: 1,
  fillColor: '#86f0a6',
  fillOpacity: 0.3
});

// Ícono personalizado para colegios (opcional)
const colegioIcon = L.divIcon({
  html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
           <path d="M12 2L2 12H5V20H10V14H14V20H19V12H22L12 2Z" fill="#1e40af"/>
         </svg>`,
  className: 'colegio-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 20]
});

// === MAPA ===
const map = L.map('map', { zoomControl: true }).setView([4.6, -74.1], 5);

L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OSM &copy; CARTO',
  maxZoom: 18
}).addTo(map);

// === CAPAS ===
let deptLayer;
let muniLayer;
let colegiosLayer;  // NUEVA CAPA
const allDeptBounds = L.latLngBounds();
const deptIndexByKey = new Map();

const selectDpto = document.getElementById('select-dpto');
let currentDeptKey = null;

// === CARGA DE DEPARTAMENTOS ===
fetch(DEPTOS_URL)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(deptGeo => {
    console.log('Departamentos.geojson cargado');

    deptLayer = L.geoJSON(deptGeo, {
      style: deptDefaultStyle,
      onEachFeature: (feature, layer) => {
        const name = getDeptName(feature);
        const key = getDeptKey(feature);

        if (key) {
          deptIndexByKey.set(key, { layer, name });
          console.log(`Departamento cargado: ${name} | DeCodigo: ${key}`);
        }

        const b = layer.getBounds();
        if (b.isValid()) allDeptBounds.extend(b);

        layer.bindTooltip(name, { sticky: true });

        layer.on({
          mouseover: () => {
            layer.setStyle(deptHighlightStyle());
            layer.bringToFront();
          },
          mouseout: () => {
            if (muniLayer && map.hasLayer(muniLayer)) {
              layer.setStyle(deptDimmedStyle());
            } else {
              deptLayer.resetStyle(layer);
            }
          },
          click: () => {
            if (key && selectDpto) {
              selectDpto.value = key;
              selectDpto.dispatchEvent(new Event('change'));
            }
          }
        });
      }
    }).addTo(map);

    // Llenar select
    const items = Array.from(deptIndexByKey.entries())
      .map(([key, data]) => ({ key, label: `${data.name} (${key})` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));

    items.forEach(({ key, label }) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      selectDpto.appendChild(opt);
    });

    if (allDeptBounds.isValid()) {
      map.fitBounds(allDeptBounds, { padding: [20, 20] });
    }

    showOnlyDepartamentos();
  })
  .catch(err => {
    console.error('Error:', err);
    document.getElementById('error-message').textContent = 'Error: No se pudo cargar Departamentos.geojson';
  });

// === LIMPIAR CAPAS ===
function clearLayers() {
  if (muniLayer) { map.removeLayer(muniLayer); muniLayer = null; }
  if (colegiosLayer) { map.removeLayer(colegiosLayer); colegiosLayer = null; }
}

// === MOSTRAR SOLO DEPARTAMENTOS ===
function showOnlyDepartamentos() {
  clearLayers();
  if (deptLayer) {
    deptLayer.eachLayer(l => deptLayer.resetStyle(l));
    map.fitBounds(allDeptBounds, { padding: [20, 20] });
  }
  currentDeptKey = null;
  document.getElementById('error-message').textContent = '';
}

// === CARGAR MUNICIPIOS Y COLEGIOS ===
function loadMunicipiosAndColegios(deptKey) {
  // Cargar municipios
  const muniUrl = MUNI_URL_TEMPLATE(deptKey);
  console.log('Cargando municipios desde:', muniUrl);

  fetch(muniUrl)
    .then(r => {
      if (!r.ok) throw new Error(`Municipios: HTTP ${r.status}`);
      return r.json();
    })
    .then(muniGeo => {
      if (muniLayer) map.removeLayer(muniLayer);
      muniLayer = L.geoJSON(muniGeo, {
        style: muniStyle,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(getMunName(feature), { sticky: true });
        }
      }).addTo(map);
    })
    .catch(err => {
      console.warn('No se cargaron municipios:', err.message);
      if (muniLayer) map.removeLayer(muniLayer);
      muniLayer = null;
    });

  // CARGAR COLEGIOS
  const colegiosUrl = COLEGIOS_URL_TEMPLATE(deptKey);
  console.log('Cargando colegios desde:', colegiosUrl);

  fetch(colegiosUrl)
    .then(r => {
      if (!r.ok) {
        if (r.status === 404) {
          console.warn(`Archivo de colegios no encontrado: ${colegiosUrl}`);
          return null;
        }
        throw new Error(`Colegios: HTTP ${r.status}`);
      }
      return r.json();
    })
    .then(colegiosGeo => {
      if (!colegiosGeo || !colegiosGeo.features?.length) {
        console.warn('No hay colegios en este departamento o archivo vacío.');
        return;
      }

      if (colegiosLayer) map.removeLayer(colegiosLayer);
      colegiosLayer = L.geoJSON(colegiosGeo, {
        pointToLayer: (feature, latlng) => {
          return L.marker(latlng, { icon: colegioIcon });
        },
        onEachFeature: (feature, layer) => {
          const nombre = getColegioName(feature);
          layer.bindTooltip(nombre, { sticky: true, direction: 'top' });
        }
      }).addTo(map);

      console.log(`Colegios cargados: ${colegiosGeo.features.length}`);
    })
    .catch(err => {
      console.warn('No se cargaron colegios:', err.message);
      if (colegiosLayer) map.removeLayer(colegiosLayer);
      colegiosLayer = null;
    });
}

// === MANEJAR SELECCIÓN ===
function handleSelectChange(deptKey) {
  if (deptKey === '__ALL__') {
    showOnlyDepartamentos();
    return;
  }

  console.log('Seleccionado departamento con DeCodigo:', deptKey);
  currentDeptKey = deptKey;

  // Resaltar departamento
  deptLayer.eachLayer(l => {
    const layerKey = getDeptKey(l.feature);
    if (layerKey === deptKey) {
      l.setStyle(deptHighlightStyle());
      const b = l.getBounds();
      if (b.isValid()) map.fitBounds(b, { maxZoom: MAX_ZOOM_ON_FOCUS, padding: [50, 50] });
    } else {
      l.setStyle(deptDimmedStyle());
    }
  });

  // Cargar municipios y colegios
  loadMunicipiosAndColegios(deptKey);

  document.getElementById('error-message').textContent = '';
}

// === EVENTOS ===
if (selectDpto) {
  selectDpto.addEventListener('change', e => handleSelectChange(e.target.value));
}