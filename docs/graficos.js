// graficos.js
let datosColegios = [];

// Contextos de las 3 gráficas
const ctxDepto = document.getElementById('chart-departamento')?.getContext('2d');
const ctxSec = document.getElementById('chart-secretaria')?.getContext('2d');
const ctxMuni = document.getElementById('chart-municipio')?.getContext('2d');

let chartDepto, chartSec, chartMuni;

// === CARGAR EXCEL ===
async function cargarDatos() {
  try {
    const response = await fetch('ColegiosPrueba.xlsx');
    if (!response.ok) throw new Error('Archivo no encontrado: ColegiosPrueba.xlsx');

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    datosColegios = XLSX.utils.sheet_to_json(sheet);

    console.log("Datos cargados:", datosColegios.length, "registros"); // DEBUG

    // === LLENAR DEPARTAMENTOS ===
    const departamentos = [...new Set(datosColegios.map(r => r.DEPARTAMEN).filter(Boolean))].sort();
    const deptSelect = document.getElementById('departamentoSelect');
    deptSelect.innerHTML = '<option value="">Todos</option>'; // Limpiar

    departamentos.forEach(d => {
      const option = new Option(d, d);
      deptSelect.add(option);
    });

    // === EVENTOS ===
    deptSelect.addEventListener('change', actualizarSecretarias);
    document.getElementById('secretariaSelect').addEventListener('change', actualizarMunicipios);
    document.getElementById('municipioSelect').addEventListener('change', actualizarGraficos);

    // Iniciar
    actualizarGraficos();

  } catch (err) {
    console.error("Error al cargar Excel:", err);
    alert(`ERROR: ${err.message}\n\n` +
          `1. Asegúrate de que "ColegiosPrueba.xlsx" está en la misma carpeta.\n` +
          `2. Abre con Live Server (VS Code).\n` +
          `3. No uses file://`);
  }
}

// === ACTUALIZAR SECRETARÍAS ===
function actualizarSecretarias() {
  const dept = document.getElementById('departamentoSelect').value;
  const secSelect = document.getElementById('secretariaSelect');
  const munSelect = document.getElementById('municipioSelect');

  // Reset
  secSelect.innerHTML = '<option value="">-- Seleccione departamento --</option>';
  munSelect.innerHTML = '<option value="">-- Seleccione secretaría --</option>';
  secSelect.disabled = true;
  munSelect.disabled = true;

  if (dept) {
    const secretarias = [...new Set(
      datosColegios
        .filter(r => r.DEPARTAMEN === dept)
        .map(r => r.SECRETARIA)
        .filter(Boolean)
    )].sort();

    secSelect.innerHTML = '<option value="">Todas las secretarías</option>';
    secretarias.forEach(s => secSelect.add(new Option(s, s)));
    secSelect.disabled = false;
  }

  actualizarMunicipios();
}

// === ACTUALIZAR MUNICIPIOS ===
function actualizarMunicipios() {
  const dept = document.getElementById('departamentoSelect').value;
  const sec = document.getElementById('secretariaSelect').value;
  const munSelect = document.getElementById('municipioSelect');

  munSelect.innerHTML = '<option value="">-- Seleccione secretaría --</option>';
  munSelect.disabled = true;

  if (dept && sec) {
    const municipios = [...new Set(
      datosColegios
        .filter(r => r.DEPARTAMEN === dept && r.SECRETARIA === sec)
        .map(r => r.MUNICIPIO)
        .filter(Boolean)
    )].sort();

    munSelect.innerHTML = '<option value="">Todos los municipios</option>';
    municipios.forEach(m => munSelect.add(new Option(m, m)));
    munSelect.disabled = false;
  }

  actualizarGraficos();
}

// === OBTENER DATOS FILTRADOS ===
function obtenerDatosFiltrados() {
  let datos = [...datosColegios];
  const dept = document.getElementById('departamentoSelect').value;
  const sec = document.getElementById('secretariaSelect').value;
  const mun = document.getElementById('municipioSelect').value;

  if (dept) datos = datos.filter(r => r.DEPARTAMEN === dept);
  if (sec) datos = datos.filter(r => r.SECRETARIA === sec);
  if (mun) datos = datos.filter(r => r.MUNICIPIO === mun);

  return datos;
}

// === CALCULAR PORCENTAJE ===
function calcularPorcentaje(datos, campo) {
  if (datos.length === 0) return 0;
  const si = datos.filter(r => String(r[campo]).trim().toUpperCase() === 'SI').length;
  return (si / datos.length) * 100;
}

// === ACTUALIZAR GRÁFICAS ===
function actualizarGraficos() {
  const datos = obtenerDatosFiltrados();

  // === GRÁFICA 1: DEPARTAMENTO (Torta general) ===
  if (ctxDepto) {
    const visitados = calcularPorcentaje(datos, 'VISITADOS_ECISL');

    const data = {
      labels: ['Visitados', 'No Visitados'],
      datasets: [{
        data: [visitados, 100 - visitados],
        backgroundColor: ['#27ae60', '#c0392b'],
        borderColor: '#fff',
        borderWidth: 3
      }]
    };

    if (chartDepto) chartDepto.destroy();
    chartDepto = new Chart(ctxDepto, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Resumen General', font: { size: 16 } }
        }
      }
    });
  }

  // === GRÁFICA 2: SECRETARÍA (Barras) ===
  if (ctxSec && document.getElementById('secretariaSelect').value) {
    const sec = document.getElementById('secretariaSelect').value;
    const datosSec = datosColegios.filter(r => r.SECRETARIA === sec);
    const visitados = calcularPorcentaje(datosSec, 'VISITADOS_ECISL');

    const data = {
      labels: ['Visitados ECISL'],
      datasets: [{
        label: '% Cumplimiento',
        data: [visitados],
        backgroundColor: ['#27ae60'],
        borderRadius: 6
      }]
    };

    if (chartSec) chartSec.destroy();
    chartSec = new Chart(ctxSec, {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        plugins: { title: { display: true, text: `Secretaría: ${sec}` } },
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
  }

  // === GRÁFICA 3: MUNICIPIO (Torta) ===
  if (ctxMuni && document.getElementById('municipioSelect').value) {
    const mun = document.getElementById('municipioSelect').value;
    const datosMun = datos.filter(r => r.MUNICIPIO === mun);
    const copasst = calcularPorcentaje(datosMun, 'COPASST');

    const data = {
      labels: ['Con COPASST', 'Sin COPASST'],
      datasets: [{
        data: [copasst, 100 - copasst],
        backgroundColor: ['#27ae60', '#c0392b'],
        borderColor: '#fff',
        borderWidth: 4
      }]
    };

    if (chartMuni) chartMuni.destroy();
    chartMuni = new Chart(ctxMuni, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        cutout: '65%',
        plugins: { title: { display: true, text: `Municipio: ${mun}` } }
      }
    });
  }
}

// === INICIAR AL CARGAR EL DOM ===
document.addEventListener('DOMContentLoaded', cargarDatos);