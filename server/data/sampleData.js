const uid = () => Math.random().toString(36).slice(2, 10);
const hoyISO = () => new Date().toISOString().slice(0, 10);

const TIPOS = [
  { digito: '1', nombre: 'Activo', natural: 'Deudora' },
  { digito: '2', nombre: 'Pasivo', natural: 'Acreedora' },
  { digito: '3', nombre: 'Capital contable', natural: 'Acreedora' },
  { digito: '4', nombre: 'Costos y gastos', natural: 'Deudora' },
  { digito: '5', nombre: 'Ingresos', natural: 'Acreedora' },
];

const tipoDe = cod => TIPOS.find(t => t.digito === String(cod || '')[0]) || null;

const sampleUsers = [
  { id: uid(), usuario: 'admin', nombre: 'Ana Portillo', rol: 'admin', sal: uid(), creado: '2026-01-01' },
  { id: uid(), usuario: 'contador', nombre: 'Luis Menjívar', rol: 'usuario', sal: uid(), creado: '2026-01-05' },
];

const sampleCuentas = [
  ['1101', 'Caja general'], ['1102', 'Bancos'], ['1103', 'Cuentas por cobrar'],
  ['1104', 'Inventario de mercadería'], ['1201', 'Mobiliario y equipo'], ['1202', 'Equipo de transporte'],
  ['2101', 'Cuentas por pagar'], ['2102', 'IVA por pagar'], ['2103', 'Sueldos por pagar'],
  ['2201', 'Préstamos bancarios a largo plazo'], ['3101', 'Capital social'], ['3102', 'Utilidades acumuladas'],
  ['4101', 'Costo de venta'], ['4201', 'Sueldos y salarios'], ['4202', 'Alquileres'],
  ['4203', 'Servicios básicos'], ['4204', 'Papelería y útiles'], ['4205', 'Depreciación'],
  ['5101', 'Ventas'], ['5102', 'Ingresos por servicios'], ['5103', 'Otros ingresos'],
].map(([codigo, nombre]) => ({ id: uid(), codigo, nombre, estado: 'Activa' }));

const sampleAsientos = [
  { fecha: '2026-01-02', concepto: 'Aporte inicial de los socios en efectivo', lineas: [
    { codigo: '1102', detalle: 'Depósito en cuenta corriente', debe: 25000, haber: 0 },
    { codigo: '3101', detalle: 'Capital social suscrito', debe: 0, haber: 25000 },
  ] },
  { fecha: '2026-01-10', concepto: 'Compra de mobiliario al crédito', lineas: [
    { codigo: '1201', detalle: 'Escritorios y estantería', debe: 4200, haber: 0 },
    { codigo: '2101', detalle: 'Proveedor Muebles del Valle', debe: 0, haber: 4200 },
  ] },
  { fecha: '2026-02-05', concepto: 'Compra de mercadería de contado', lineas: [
    { codigo: '1104', detalle: 'Ingreso a bodega', debe: 8000, haber: 0 },
    { codigo: '1102', detalle: 'Pago con cheque', debe: 0, haber: 8000 },
  ] },
  { fecha: '2026-02-28', concepto: 'Venta de mercadería al contado', lineas: [
    { codigo: '1101', detalle: 'Cobro en efectivo', debe: 6500, haber: 0 },
    { codigo: '5101', detalle: 'Venta del mes', debe: 0, haber: 6500 },
    { codigo: '4101', detalle: 'Costo de la mercadería vendida', debe: 3900, haber: 0 },
    { codigo: '1104', detalle: 'Salida de bodega', debe: 0, haber: 3900 },
  ] },
  { fecha: '2026-03-01', concepto: 'Pago de alquiler y servicios del local', lineas: [
    { codigo: '4202', detalle: 'Alquiler de marzo', debe: 900, haber: 0 },
    { codigo: '4203', detalle: 'Energía eléctrica y agua', debe: 260, haber: 0 },
    { codigo: '1102', detalle: 'Transferencia bancaria', debe: 0, haber: 1160 },
  ] },
  { fecha: '2026-03-15', concepto: 'Servicios de asesoría prestados al crédito', lineas: [
    { codigo: '1103', detalle: 'Cliente Industrias Lempa', debe: 3200, haber: 0 },
    { codigo: '5102', detalle: 'Servicios profesionales', debe: 0, haber: 3200 },
  ] },
  { fecha: '2026-03-31', concepto: 'Planilla de sueldos del trimestre', lineas: [
    { codigo: '4201', detalle: 'Sueldos administrativos', debe: 4100, haber: 0 },
    { codigo: '2103', detalle: 'Planilla por pagar', debe: 0, haber: 4100 },
  ] },
].map((a, index) => ({
  id: uid(),
  numero: index + 1,
  fecha: a.fecha,
  concepto: a.concepto,
  lineas: a.lineas.map(l => ({
    codigo: l.codigo,
    detalle: l.detalle,
    debe: Number(l.debe),
    haber: Number(l.haber),
  })),
  registradoPor: 'admin',
  registradoEn: hoyISO(),
}));

module.exports = { sampleUsers, sampleCuentas, sampleAsientos, tipoDe, TIPOS, uid, hoyISO };
