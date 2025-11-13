// === ARCHIVOS ===
const DEPTOS_URL = 'Departamentos.geojson';
const MUNI_URL_TEMPLATE = (code) => `Municipios_${code}.geojson`;
const COLEGIOS_URL_TEMPLATE = (code) => `Colegios_${code}.geojson`;

// === CAMPOS ===
const DEPT_CODE_FIELD = 'DeCodigo';
const DEPT_NAME_FIELD = 'DeNombre';
const MUNI_DEPT_CODE_FIELD = 'DeCodigo';
const MUNI_NAME_FIELD = 'MpNombre';
const COLEGIO_NAME_FIELD = 'NOMBRE_INS';

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
  color: '#07bba6ff',
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
  color: '#b2be45ff',
  weight: 1,
  fillColor: '#86f0a6',
  fillOpacity: 0.2
});

// Ícono pequeño y circular para colegios
const colegioIcon = L.divIcon({
  html: `<div style="
    width: 10px;
    height: 10px;
    background-color: #1e40af;
    border: 2px solid white;
    border-radius: 50%;
  "></div>`,
  className: 'colegio-marker',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// === MAPA ===
const map = L.map('map', { zoomControl: true }).setView([4.6, -74.1], 5);

// 4. Positron (claro, minimalista)
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OSM &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

// === CAPAS ===
let deptLayer;
let muniLayer;
let colegiosLayer;
const allDeptBounds = L.latLngBounds();
const deptIndexByKey = new Map();

const selectDpto = document.getElementById('select-dpto');
const toggleColegiosCheckbox = document.getElementById('toggle-visibles');
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
        if (colegiosLayer) { map.removeLayer(colegiosLayer); colegiosLayer = null; }
        return;
      }

      if (colegiosLayer) map.removeLayer(colegiosLayer);

      colegiosLayer = L.geoJSON(colegiosGeo, {
        pointToLayer: (feature, latlng) => {
          return L.marker(latlng, { icon: colegioIcon });
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const nombre = getColegioName(feature);

          // Tooltip al pasar el mouse
          layer.bindTooltip(nombre, { sticky: true, direction: 'top' });

          // === POPUP AL HACER CLIC ===
          const direccion = normalize(props['DIRECCION']) || 'No disponible';
          const sede = normalize(props['SEDE_PRINC']) || 'No disponible';
          const zona = normalize(props['ZONA']) || 'No disponible';
          const jornada = normalize(props['JORNADA']) || 'No disponible';
          const codDane = normalize(props['COD_DANE']) || 'No disponible';
          const copasst = normalize(props['COPASST']) || 'No disponible';
          const visitado = normalize(props['VISITADO_ECISL']) || 'No disponible';
          const numdocentes = normalize(props['DOCENTES']) || 'No disponible';

          const popupContent = `
            <div style="font-family: Arial, sans-serif; min-width: 200px;">
              <h3 style="margin: 0 0 8px; color: #1e40af; font-size: 16px;">${nombre}</h3>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr><td><strong>Código DANE:</strong></td><td>${codDane}</td></tr>
                <tr><td><strong>Dirección:</strong></td><td>${direccion}</td></tr>
                <tr><td><strong>Sede Principal:</strong></td><td>${sede}</td></tr>
                <tr><td><strong>Zona:</strong></td><td>${zona}</td></tr>
                <tr><td><strong>Jornada:</strong></td><td>${jornada}</td></tr>
                <tr><td><strong>COPASST:</strong></td><td>${copasst}</td></tr>
                <tr><td><strong>Visitado ECIS-L:</strong></td><td>${visitado}</td></tr>
                <tr><td><strong>Número de Docentes:</strong></td><td>${numdocentes}</td></tr>
              </table>
            </div>
          `;

          layer.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'colegio-popup'
          });
        }
      });

      // Solo mostrar si el checkbox está marcado
      if (toggleColegiosCheckbox && toggleColegiosCheckbox.checked) {
        colegiosLayer.addTo(map);
        console.log(`Colegios cargados y visibles: ${colegiosGeo.features.length}`);
      } else {
        console.log(`Colegios cargados pero ocultos: ${colegiosGeo.features.length}`);
      }
    })
    .catch(err => {
      console.warn('No se cargaron colegios:', err.message);
      if (colegiosLayer) { map.removeLayer(colegiosLayer); colegiosLayer = null; }
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

// === CONTROL DE VISIBILIDAD DE COLEGIOS ===
if (toggleColegiosCheckbox) {
  toggleColegiosCheckbox.addEventListener('change', function () {
    if (!colegiosLayer) return;

    if (this.checked) {
      map.addLayer(colegiosLayer);
      console.log('Colegios: visibles');
    } else {
      map.removeLayer(colegiosLayer);
      console.log('Colegios: ocultos');
    }
  });
}

// === EVENTOS ===
if (selectDpto) {
  selectDpto.addEventListener('change', e => handleSelectChange(e.target.value));
}