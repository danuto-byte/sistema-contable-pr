const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const path = require('node:path');
const { connectMongo } = require('./config/db');
const { sampleUsers, sampleCuentas, sampleAsientos, tipoDe, TIPOS, uid, hoyISO } = require('./data/sampleData');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const hashText = (texto, sal) => crypto.createHash('sha256').update(`${sal}::${texto}`).digest('hex');
const redondear = n => Math.round((Number(n) || 0) * 100) / 100;

const state = {
  usuarios: sampleUsers.map(u => ({ ...u, hash: hashText('admin123', u.sal) }))
    .map(u => u.usuario === 'contador' ? { ...u, hash: hashText('user123', u.sal) } : u),
  cuentas: sampleCuentas,
  asientos: sampleAsientos,
  auditoria: [],
};

const validarPartidaDoble = lineas => {
  const debe = lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0);
  const haber = lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0);
  return Math.abs(debe - haber) < 0.005;
};

const respondeError = (res, status, detalle) => res.status(status).json({ ok: false, error: detalle });

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'sistema-contable', timestamp: new Date().toISOString() });
});

app.get('/api/usuarios', (req, res) => {
  res.json(state.usuarios.map(({ hash, sal, ...rest }) => rest));
});

app.post('/api/auth/login', (req, res) => {
  const { usuario, clave } = req.body || {};
  const u = state.usuarios.find(x => x.usuario.toLowerCase() === String(usuario || '').toLowerCase());

  if (!u) return respondeError(res, 401, 'Usuario no encontrado');
  if (hashText(String(clave || ''), u.sal) !== u.hash) return respondeError(res, 401, 'Contraseña incorrecta');

  const { hash, sal, ...usuarioPublico } = u;
  res.json({
    token: `demo-${u.id}`,
    usuario: { ...usuarioPublico, password: undefined },
  });
});

app.get('/api/cuentas', (req, res) => {
  res.json(state.cuentas);
});

app.post('/api/cuentas', (req, res) => {
  const { codigo, nombre, estado = 'Activa' } = req.body || {};

  if (!/^\d{3,6}$/.test(String(codigo || ''))) {
    return respondeError(res, 400, 'El código debe tener de 3 a 6 dígitos.');
  }
  if (!tipoDe(codigo)) {
    return respondeError(res, 400, 'El primer dígito del código debe corresponder a una cuenta contable válida.');
  }
  if (!nombre || String(nombre).trim().length < 3) {
    return respondeError(res, 400, 'El nombre es obligatorio.');
  }

  const existe = state.cuentas.some(c => c.codigo === String(codigo));
  if (existe) return respondeError(res, 409, 'Ese código ya existe en el catálogo.');

  const cuenta = { id: uid(), codigo: String(codigo), nombre: String(nombre).trim(), estado: String(estado) };
  state.cuentas.push(cuenta);
  state.auditoria.unshift({ cuando: new Date().toISOString(), accion: 'Cuenta creada', detalle: cuenta.codigo });
  res.status(201).json(cuenta);
});

app.get('/api/asientos', (req, res) => {
  res.json(state.asientos);
});

app.post('/api/asientos', (req, res) => {
  const { fecha, concepto, lineas = [] } = req.body || {};
  const ll = Array.isArray(lineas) ? lineas : [];

  if (!fecha) return respondeError(res, 400, 'La fecha es obligatoria.');
  if (!concepto || String(concepto).trim().length < 4) return respondeError(res, 400, 'El concepto es obligatorio.');
  if (ll.length < 2) return respondeError(res, 400, 'El asiento requiere al menos dos líneas.');
  if (!validarPartidaDoble(ll)) return respondeError(res, 400, 'La suma del debe y el haber no coincide.');

  const validas = ll.filter(l => l.codigo && ((Number(l.debe) || 0) > 0 || (Number(l.haber) || 0) > 0));
  if (validas.length < 2) return respondeError(res, 400, 'Debe haber al menos dos cuentas con importe.');

  const asiento = {
    id: uid(),
    numero: state.asientos.length + 1,
    fecha,
    concepto: String(concepto).trim(),
    lineas: ll.map(l => ({
      codigo: String(l.codigo),
      detalle: String(l.detalle || ''),
      debe: redondear(l.debe),
      haber: redondear(l.haber),
    })),
    registradoPor: 'api',
    registradoEn: new Date().toISOString(),
  };

  state.asientos.push(asiento);
  state.auditoria.unshift({ cuando: new Date().toISOString(), accion: 'Asiento creado', detalle: `N.º ${asiento.numero}` });
  res.status(201).json(asiento);
});

app.get('/api/reportes/mayor', (req, res) => {
  const { desde = '2026-01-01', hasta = hoyISO() } = req.query;
  const mayor = {};

  state.asientos.filter(a => a.fecha >= desde && a.fecha <= hasta).forEach(a => {
    a.lineas.forEach(l => {
      const t = tipoDe(l.codigo);
      if (!t) return;

      const cuenta = mayor[l.codigo] || {
        codigo: l.codigo,
        nombre: state.cuentas.find(c => c.codigo === l.codigo)?.nombre || 'Cuenta no catalogada',
        tipo: t.nombre,
        natural: t.natural,
        movimientos: [],
        totalDebe: 0,
        totalHaber: 0,
        saldo: 0,
      };

      cuenta.totalDebe += Number(l.debe) || 0;
      cuenta.totalHaber += Number(l.haber) || 0;
      cuenta.saldo = t.natural === 'Deudora' ? cuenta.totalDebe - cuenta.totalHaber : cuenta.totalHaber - cuenta.totalDebe;
      cuenta.movimientos.push({
        fecha: a.fecha,
        numero: a.numero,
        concepto: l.detalle || a.concepto,
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
        acumulado: cuenta.saldo,
      });

      mayor[l.codigo] = cuenta;
    });
  });

  res.json(Object.values(mayor).sort((a, b) => a.codigo.localeCompare(b.codigo)));
});

app.get('/api/reportes/balance', (req, res) => {
  const { hasta = hoyISO() } = req.query;
  const mayor = require('./data/sampleData');
  const datos = state.asientos.filter(a => a.fecha <= hasta);
  const saldoPorCuenta = {};
  for (const a of datos) {
    for (const l of a.lineas) {
      const t = tipoDe(l.codigo);
      if (!t) continue;
      saldoPorCuenta[l.codigo] = (saldoPorCuenta[l.codigo] || 0) + ((Number(l.debe) || 0) - (Number(l.haber) || 0));
    }
  }

  const activos = Object.entries(saldoPorCuenta)
    .filter(([codigo]) => String(codigo)[0] === '1')
    .map(([codigo, saldo]) => ({ codigo, nombre: state.cuentas.find(c => c.codigo === codigo)?.nombre || codigo, saldo: redondear(saldo) }));
  const pasivos = Object.entries(saldoPorCuenta)
    .filter(([codigo]) => String(codigo)[0] === '2')
    .map(([codigo, saldo]) => ({ codigo, nombre: state.cuentas.find(c => c.codigo === codigo)?.nombre || codigo, saldo: redondear(saldo) }));
  const capital = Object.entries(saldoPorCuenta)
    .filter(([codigo]) => String(codigo)[0] === '3')
    .map(([codigo, saldo]) => ({ codigo, nombre: state.cuentas.find(c => c.codigo === codigo)?.nombre || codigo, saldo: redondear(saldo) }));

  const activo = activos.reduce((s, c) => s + c.saldo, 0);
  const pasivo = pasivos.reduce((s, c) => s + c.saldo, 0);
  const capitalTotal = capital.reduce((s, c) => s + c.saldo, 0);

  res.json({ activos, pasivos, capital, activo, pasivo, capitalTotal, cuadra: Math.abs(activo - pasivo - capitalTotal) < 0.01 });
});

app.get('/api/reportes/resultados', (req, res) => {
  const { desde = '2026-01-01', hasta = hoyISO() } = req.query;
  const mayor = {};

  state.asientos.filter(a => a.fecha >= desde && a.fecha <= hasta).forEach(a => {
    a.lineas.forEach(l => {
      const t = tipoDe(l.codigo);
      if (!t) return;
      if (!mayor[l.codigo]) {
        mayor[l.codigo] = { codigo: l.codigo, saldo: 0 };
      }
      mayor[l.codigo].saldo += (Number(l.debe) || 0) - (Number(l.haber) || 0);
    });
  });

  const ingresos = Object.entries(mayor)
    .filter(([codigo]) => String(codigo)[0] === '5')
    .reduce((s, [, v]) => s + v.saldo, 0);
  const gastos = Object.entries(mayor)
    .filter(([codigo]) => String(codigo)[0] === '4')
    .reduce((s, [, v]) => s + v.saldo, 0);

  const utilidad = ingresos - gastos;
  res.json({ ingresos: redondear(ingresos), costosGastos: redondear(gastos), utilidad: redondear(utilidad) });
});

app.use(express.static(path.join(__dirname, '..')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

async function startServer(options = {}) {
  const port = options.port || Number(process.env.PORT) || 3000;
  await connectMongo();
  return new Promise(resolve => {
    const server = app.listen(port, () => resolve({ server, port }));
  });
}

async function stopServer(server) {
  if (!server) return;
  await new Promise(resolve => server.close(resolve));
}

if (require.main === module) {
  startServer().then(({ port }) => {
    console.log(`Servidor activo en http://localhost:${port}`);
  }).catch(err => {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer, stopServer, hashText };
