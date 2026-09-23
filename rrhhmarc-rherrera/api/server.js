const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function esperarBaseDeDatos(reintentos = 15) {
  for (let i = 0; i < reintentos; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Conexión a la base de datos establecida.');
      return;
    } catch (err) {
      console.log(`Esperando base de datos... intento ${i + 1}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('No se pudo conectar a la base de datos.');
}

function horaValida(hora) {
  return /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(hora || '');
}

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function calcularEstado(programada, real, toleranciaMin = 5) {
  const diff = minutos(real) - minutos(programada);
  return diff <= toleranciaMin ? 'PUNTUAL' : 'ATRASO';
}

function validarMarcacion(body) {
  const errores = [];
  if (!body.codigo_empleado) errores.push('codigo_empleado es obligatorio.');
  if (!body.nombre_empleado) errores.push('nombre_empleado es obligatorio.');
  if (!body.fecha) errores.push('fecha es obligatoria.');
  if (!horaValida(body.hora_ingreso_programada)) errores.push('hora_ingreso_programada inválida.');
  if (!horaValida(body.hora_ingreso_real)) errores.push('hora_ingreso_real inválida.');
  if (body.hora_salida_programada && !horaValida(body.hora_salida_programada)) errores.push('hora_salida_programada inválida.');
  if (body.hora_salida_real && !horaValida(body.hora_salida_real)) errores.push('hora_salida_real inválida.');
  if (body.hora_salida_real && body.hora_ingreso_real &&
      minutos(body.hora_salida_real) < minutos(body.hora_ingreso_real)) {
    errores.push('La hora de salida no puede ser anterior a la hora de ingreso.');
  }
  return errores;
}

app.post('/api/marcaciones', async (req, res) => {
  const errores = validarMarcacion(req.body);
  if (errores.length) return res.status(400).json({ errores });

  const {
    codigo_empleado, nombre_empleado, fecha,
    hora_ingreso_programada, hora_ingreso_real,
    hora_salida_programada, hora_salida_real, observacion,
  } = req.body;

  const estado = hora_salida_real ? calcularEstado(hora_ingreso_programada, hora_ingreso_real) : 'INCOMPLETO';

  try {
    const result = await pool.query(
      `INSERT INTO marcaciones
        (codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real,
         hora_salida_programada, hora_salida_real, estado, observacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real,
       hora_salida_programada || null, hora_salida_real || null, estado, observacion || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.get('/api/marcaciones', async (req, res) => {
  const { empleado, fecha } = req.query;
  let query = 'SELECT * FROM marcaciones WHERE 1=1';
  const params = [];
  if (empleado) { params.push(empleado); query += ` AND codigo_empleado = $${params.length}`; }
  if (fecha) { params.push(fecha); query += ` AND fecha = $${params.length}`; }
  query += ' ORDER BY fecha DESC, id DESC';
  try {
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.get('/api/marcaciones/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM marcaciones WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Marcación no encontrada.' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.put('/api/marcaciones/:id', async (req, res) => {
  const errores = validarMarcacion(req.body);
  if (errores.length) return res.status(400).json({ errores });

  const {
    codigo_empleado, nombre_empleado, fecha,
    hora_ingreso_programada, hora_ingreso_real,
    hora_salida_programada, hora_salida_real, observacion,
  } = req.body;

  const estado = hora_salida_real ? calcularEstado(hora_ingreso_programada, hora_ingreso_real) : 'INCOMPLETO';

  try {
    const result = await pool.query(
      `UPDATE marcaciones SET
        codigo_empleado=$1, nombre_empleado=$2, fecha=$3,
        hora_ingreso_programada=$4, hora_ingreso_real=$5,
        hora_salida_programada=$6, hora_salida_real=$7,
        estado=$8, observacion=$9
       WHERE id=$10 RETURNING *`,
      [codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real,
       hora_salida_programada || null, hora_salida_real || null, estado, observacion || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Marcación no encontrada.' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.delete('/api/marcaciones/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM marcaciones WHERE id=$1 RETURNING *', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Marcación no encontrada.' });
    res.status(200).json({ mensaje: 'Marcación eliminada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
esperarBaseDeDatos().then(() => {
  app.listen(PORT, () => console.log(`API escuchando en el puerto ${PORT}`));
});