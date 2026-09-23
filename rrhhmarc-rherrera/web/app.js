const API_URL = 'http://localhost:3000/api/marcaciones';

const form = document.getElementById('formMarcacion');
const tabla = document.getElementById('tablaMarcaciones');

const CAMPOS = [
  'codigo_empleado',
  'nombre_empleado',
  'fecha',
  'hora_ingreso_programada',
  'hora_ingreso_real',
  'hora_salida_programada',
  'hora_salida_real',
  'observacion',
];

let marcaciones = [];

const hhmm = (v) => (v ? v.slice(0, 5) : '');
const soloFecha = (v) => (v ? v.slice(0, 10) : '');

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function limpiarFormulario() {
  form.reset();
  document.getElementById('id').value = '';
}

async function cargar() {
  const params = new URLSearchParams();
  const empleado = document.getElementById('filtroEmpleado').value.trim();
  const fecha = document.getElementById('filtroFecha').value;
  if (empleado) params.set('empleado', empleado);
  if (fecha) params.set('fecha', fecha);

  try {
    const res = await fetch(`${API_URL}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    marcaciones = await res.json();
    render();
  } catch (err) {
    tabla.innerHTML = `<tr><td colspan="11">No se pudo cargar: ${escapar(err.message)}</td></tr>`;
  }
}

function render() {
  if (!marcaciones.length) {
    tabla.innerHTML = '<tr><td colspan="11">Sin registros.</td></tr>';
    return;
  }
  tabla.innerHTML = marcaciones
    .map(
      (m) => `
    <tr>
      <td>${m.id}</td>
      <td>${escapar(m.codigo_empleado)}</td>
      <td>${escapar(m.nombre_empleado)}</td>
      <td>${soloFecha(m.fecha)}</td>
      <td>${hhmm(m.hora_ingreso_programada)}</td>
      <td>${hhmm(m.hora_ingreso_real)}</td>
      <td>${hhmm(m.hora_salida_programada)}</td>
      <td>${hhmm(m.hora_salida_real)}</td>
      <td class="${escapar(m.estado)}">${escapar(m.estado)}</td>
      <td>${escapar(m.observacion)}</td>
      <td>
        <button data-accion="editar" data-id="${m.id}">Editar</button>
        <button data-accion="eliminar" data-id="${m.id}">Eliminar</button>
      </td>
    </tr>`
    )
    .join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('id').value;

  const datos = {};
  CAMPOS.forEach((c) => {
    datos[c] = document.getElementById(c).value;
  });

  try {
    const res = await fetch(id ? `${API_URL}/${id}` : API_URL, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const mensajes = err.errores || [err.error || 'Error al guardar.'];
      alert(mensajes.join('\n'));
      return;
    }

    limpiarFormulario();
    cargar();
  } catch (err) {
    alert('No se pudo conectar con la API.');
  }
});

tabla.addEventListener('click', async (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton) return;

  const id = Number(boton.dataset.id);

  if (boton.dataset.accion === 'editar') {
    const m = marcaciones.find((x) => x.id === id);
    if (!m) return;
    document.getElementById('id').value = m.id;
    document.getElementById('codigo_empleado').value = m.codigo_empleado;
    document.getElementById('nombre_empleado').value = m.nombre_empleado;
    document.getElementById('fecha').value = soloFecha(m.fecha);
    document.getElementById('hora_ingreso_programada').value = hhmm(m.hora_ingreso_programada);
    document.getElementById('hora_ingreso_real').value = hhmm(m.hora_ingreso_real);
    document.getElementById('hora_salida_programada').value = hhmm(m.hora_salida_programada);
    document.getElementById('hora_salida_real').value = hhmm(m.hora_salida_real);
    document.getElementById('observacion').value = m.observacion || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (boton.dataset.accion === 'eliminar') {
    if (!confirm('¿Eliminar esta marcación?')) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cargar();
    } catch (err) {
      alert('No se pudo eliminar la marcación.');
    }
  }
});

document.getElementById('btnCancelar').addEventListener('click', limpiarFormulario);
document.getElementById('btnFiltrar').addEventListener('click', cargar);
document.getElementById('btnLimpiar').addEventListener('click', () => {
  document.getElementById('filtroEmpleado').value = '';
  document.getElementById('filtroFecha').value = '';
  cargar();
});

cargar();
