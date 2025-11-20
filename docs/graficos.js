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

    // Iniciar gráficos al cargar
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

  // Al cambiar departamento, se resetean secretaría y municipio → se actualizan gráficos
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

  // Cada vez que cambian los filtros → actualizamos todas las gráficas
  actualizarGraficos();
}

// ==================================================================
// NUEVAS FUNCIONES: Datos independientes por nivel (¡SOLUCIÓN CLAVE!)
// ==================================================================

// Datos solo del departamento seleccionado (o todos si no hay selección)
function obtenerDatosDepartamento() {
  const dept = document.getElementById('departamentoSelect').value;
  if (!dept) return datosColegios; // Si no hay departamento → todos los datos
  return datosColegios.filter(r => r.DEPARTAMEN === dept);
}

// Datos solo de la secretaría seleccionada (independiente del municipio)
function obtenerDatosSecretaria() {
  const sec = document.getElementById('secretariaSelect').value;
  if (!sec) return [];
  return datosColegios.filter(r => r.SECRETARIA === sec);
}

// Datos del municipio seleccionado (respeta departamento y secretaría)
function obtenerDatosMunicipio() {
  const dept = document.getElementById('departamentoSelect').value;
  const sec = document.getElementById('secretariaSelect').value;
  const mun = document.getElementById('municipioSelect').value;

  if (!mun) return [];

  let datos = [...datosColegios];
  if (dept) datos = datos.filter(r => r.DEPARTAMEN === dept);
  if (sec) datos = datos.filter(r => r.SECRETARIA === sec);
  return datos.filter(r => r.MUNICIPIO === mun);
}

// === CALCULAR PORCENTAJE ===
function calcularPorcentaje(datos, campo) {
  if (datos.length === 0) return 0;
  const si = datos.filter(r => String(r[campo]).trim().toUpperCase() === 'SI').length;
  return Number(((si / datos.length) * 100).toFixed(2)); // Redondeo a 2 decimales
}

// ==================================================================
// ACTUALIZAR GRÁFICAS (AHORA CADA UNA USA SUS PROPIOS DATOS)
// ==================================================================
function actualizarGraficos() {
  const deptSeleccionado = document.getElementById('departamentoSelect').value;
  const secSeleccionada = document.getElementById('secretariaSelect').value;
  const munSeleccionado = document.getElementById('municipioSelect').value;

 Chart.register(ChartDataLabels);

 // ================== GRÁFICA 1: DEPARTAMENTO ==================
  // Siempre se muestra (si hay datos), y NUNCA se afecta por secretaría o municipio
  if (ctxDepto) {
    const datosDepto = obtenerDatosDepartamento();
    const visitados = calcularPorcentaje(datosDepto, 'VISITADOS_ECISL');

    const data = {
      labels: ['Visitados', 'No Visitados'],
      datasets: [{
        data: [visitados, 100 - visitados],
        backgroundColor: ['#2ecc71', '#e67e22'],
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
          title: {
            display: true,
            text: deptSeleccionado
              ? `Departamento: ${deptSeleccionado}`
              : 'Todos los departamentos',
            font: { size: 16 }
          },

          // Labels Gráficos
          datalabels: {
            color: '#2c3e50',
            font: {
              weight: 'bold',
              size: 14
            },
            formatter: function(value) {
              return value + '%'; // lo que aparece en el gráfico
            }
          }
        }
      }
    });
  }

  // ================== GRÁFICA 2: SECRETARÍA ==================
  // Solo se muestra si hay una secretaría seleccionada
  if (ctxSec) {
    // Si no hay secretaría seleccionada → destruir gráfica si existe
    if (!secSeleccionada && chartSec) {
      chartSec.destroy();
      chartSec = null;
    }

    if (secSeleccionada) {
      const datosSec = obtenerDatosSecretaria();
      const visitados = calcularPorcentaje(datosSec, 'VISITADOS_ECISL');

      const data = {
        labels: ['Visitados ECISL'],
        datasets: [{
          label: 'Porcentaje de Instituciones Educativas Visitadas por ECIS-L',
          data: [visitados],
          backgroundColor: '#2ecc71',
          borderRadius: 6
        }]
      };

      if (chartSec) chartSec.destroy();
      chartSec = new Chart(ctxSec, {
        type: 'bar',
        data: data,
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: `Secretaría: ${secSeleccionada}` }
          },
          scales: {
            y: { beginAtZero: true, max: 100, ticks: { stepSize: 10 } }
          }
        }
      });
    }
  }

  // ================== GRÁFICA 3: MUNICIPIO ==================
  // Solo se muestra si hay municipio seleccionado
  if (ctxMuni) {
    if (!munSeleccionado && chartMuni) {
      chartMuni.destroy();
      chartMuni = null;
    }

    if (munSeleccionado) {
      const datosMun = obtenerDatosMunicipio();
      const visitados = calcularPorcentaje(datosMun, 'VISITADOS_ECISL');

      const data = {
        labels: ['Visitados', 'No Visitados'],
        datasets: [{
          data: [visitados, 100 -  visitados],
          backgroundColor: ['#2ecc71', '#e67e22'],
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
          plugins: {
            title: { display: true, text: `Municipio: ${munSeleccionado}` }
          }
        }
      });
    }
  }
}

// === INICIAR AL CARGAR EL DOM ===
document.addEventListener('DOMContentLoaded', cargarDatos);