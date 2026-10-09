/* =========================================================================
   Sistema contable — capa de presentación (Vue 3)
   Módulos: seguridad · catálogo · libro diario · mayorización · estados
   La persistencia definitiva vive en la API (Node + Express + MongoDB);
   aquí se usa almacenamiento local del navegador como respaldo temporal.
   ========================================================================= */

/* ---------- 1. Clasificación contable por primer dígito (RF10) ---------- */
const TIPOS = [
  { digito:'1', nombre:'Activo',            natural:'Deudora'   },
  { digito:'2', nombre:'Pasivo',            natural:'Acreedora' },
  { digito:'3', nombre:'Capital contable',  natural:'Acreedora' },
  { digito:'4', nombre:'Costos y gastos',   natural:'Deudora'   },
  { digito:'5', nombre:'Ingresos',          natural:'Acreedora' },
];
const tipoDe = cod => TIPOS.find(t => t.digito === String(cod || '')[0]) || null;

/* ---------- 2. Utilidades ---------- */
const fmt = new Intl.NumberFormat('es-SV', { style:'currency', currency:'USD', minimumFractionDigits:2 });
const dinero = n => fmt.format(Math.round((Number(n) || 0) * 100) / 100);
const redondear = n => Math.round((Number(n) || 0) * 100) / 100;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const sello = () => new Date().toLocaleString('es-SV', { dateStyle:'short', timeStyle:'short' });

async function hashear(texto, sal) {
  const datos = sal + '::' + texto;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(datos));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381;
  for (let i = 0; i < datos.length; i++) h = ((h << 5) + h + datos.charCodeAt(i)) | 0;
  return 'x' + Math.abs(h).toString(16);
}

/* ---------- 3. Respaldo local (opcional) ---------- */
const CLAVE = 'contable:v1';
const disco = {
  async leer() {
    try { const r = await window.storage.get(CLAVE); return r ? JSON.parse(r.value) : null; }
    catch (e) { return null; }
  },
  async escribir(datos) {
    try { await window.storage.set(CLAVE, JSON.stringify(datos)); } catch (e) { /* sesión en memoria */ }
  }
};

/* ---------- 4. Datos iniciales de ejemplo ---------- */
const CATALOGO = [
  ['1101','Caja general'],['1102','Bancos'],['1103','Cuentas por cobrar'],
  ['1104','Inventario de mercadería'],['1201','Mobiliario y equipo'],['1202','Equipo de transporte'],
  ['2101','Cuentas por pagar'],['2102','IVA por pagar'],['2103','Sueldos por pagar'],
  ['2201','Préstamos bancarios a largo plazo'],
  ['3101','Capital social'],['3102','Utilidades acumuladas'],
  ['4101','Costo de venta'],['4201','Sueldos y salarios'],['4202','Alquileres'],
  ['4203','Servicios básicos'],['4204','Papelería y útiles'],['4205','Depreciación'],
  ['5101','Ventas'],['5102','Ingresos por servicios'],['5103','Otros ingresos'],
].map(([codigo, nombre]) => ({ id:uid(), codigo, nombre, estado:'Activa' }));

const ASIENTOS = [
  { fecha:'2026-01-02', concepto:'Aporte inicial de los socios en efectivo',
    lineas:[['1102','Depósito en cuenta corriente',25000,0],['3101','Capital social suscrito',0,25000]] },
  { fecha:'2026-01-10', concepto:'Compra de mobiliario al crédito',
    lineas:[['1201','Escritorios y estantería',4200,0],['2101','Proveedor Muebles del Valle',0,4200]] },
  { fecha:'2026-02-05', concepto:'Compra de mercadería de contado',
    lineas:[['1104','Ingreso a bodega',8000,0],['1102','Pago con cheque',0,8000]] },
  { fecha:'2026-02-28', concepto:'Venta de mercadería al contado',
    lineas:[['1101','Cobro en efectivo',6500,0],['5101','Venta del mes',0,6500],
            ['4101','Costo de la mercadería vendida',3900,0],['1104','Salida de bodega',0,3900]] },
  { fecha:'2026-03-01', concepto:'Pago de alquiler y servicios del local',
    lineas:[['4202','Alquiler de marzo',900,0],['4203','Energía eléctrica y agua',260,0],['1102','Transferencia bancaria',0,1160]] },
  { fecha:'2026-03-15', concepto:'Servicios de asesoría prestados al crédito',
    lineas:[['1103','Cliente Industrias Lempa',3200,0],['5102','Servicios profesionales',0,3200]] },
  { fecha:'2026-03-31', concepto:'Planilla de sueldos del trimestre',
    lineas:[['4201','Sueldos administrativos',4100,0],['2103','Planilla por pagar',0,4100]] },
];

/* ---------- 5. Aplicación ---------- */
Vue.createApp({
  data() {
    return {
      empresa: 'Comercial San Lorenzo, S.A. de C.V.',
      tipos: TIPOS,
      sesion: null,
      login: { usuario:'', clave:'', error:'' },
      vista: 'dashboard',
      usuarios: [],
      cuentas: [],
      asientos: [],
      auditoria: [],
      periodo: { desde:'2026-01-01', hasta:hoyISO() },
      filtros: { cuenta:'', tipo:'', diario:'', numero:'', mayor:'', mayorTipo:'' },
      borrador: null,
      errores: [],
      modalCuenta: null,
      modalUsuario: null,
      brindis: null,
      titulos: {
        dashboard:'Panel contable', catalogo:'Catálogo de cuentas', nuevo:'Registrar asiento',
        diario:'Libro diario', mayor:'Libro mayor', balance:'Balance general',
        resultados:'Estado de resultados', usuarios:'Usuarios', auditoria:'Historial'
      },
      subtitulos: {
        dashboard:'Situación del ejercicio según los asientos registrados',
        catalogo:'La clasificación se asigna con el primer dígito del código',
        nuevo:'El asiento se guarda solo si el debe iguala al haber',
        diario:'Asientos en orden cronológico',
        mayor:'Se construye solo a partir del diario',
        balance:'Activo igual a pasivo más capital contable',
        resultados:'Ingresos menos costos y gastos',
        usuarios:'Altas, roles y contraseñas',
        auditoria:'Quién hizo qué y cuándo'
      }
    };
  },

  computed: {
    /* --- permisos --- */
    vistaConPeriodo() { return ['dashboard','diario','mayor','balance','resultados'].includes(this.vista); },
    vistaImprimible() { return ['catalogo','diario','mayor','balance','resultados'].includes(this.vista); },
    hoyLargo() { return new Date().toLocaleDateString('es-SV', { day:'numeric', month:'long', year:'numeric' }); },

    cuentasOrdenadas() { return [...this.cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo)); },
    cuentasActivas() { return this.cuentasOrdenadas.filter(c => c.estado === 'Activa'); },
    cuentasFiltradas() {
      const q = this.filtros.cuenta.toLowerCase();
      return this.cuentasOrdenadas.filter(c =>
        (!q || c.codigo.includes(q) || c.nombre.toLowerCase().includes(q)) &&
        (!this.filtros.tipo || c.codigo[0] === this.filtros.tipo));
    },

    /* --- asientos --- */
    asientosOrdenados() {
      return [...this.asientos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero);
    },
    asientosPeriodo() {
      return this.asientosOrdenados.filter(a => a.fecha >= this.periodo.desde && a.fecha <= this.periodo.hasta);
    },
    ultimosAsientos() { return [...this.asientosPeriodo].reverse().slice(0, 6); },
    siguienteNumero() { return this.asientos.reduce((m, a) => Math.max(m, a.numero), 0) + 1; },
    diarioFiltrado() {
      const q = this.filtros.diario.toLowerCase(), n = this.filtros.numero.trim();
      return this.asientosPeriodo.filter(a => {
        const coincideTexto = !q || a.concepto.toLowerCase().includes(q) ||
          a.lineas.some(l => l.codigo.includes(q) || this.nombreCuenta(l.codigo).toLowerCase().includes(q));
        return coincideTexto && (!n || String(a.numero) === n);
      });
    },
    totalDiario() { return redondear(this.diarioFiltrado.reduce((s, a) => s + this.totalAsiento(a), 0)); },

    /* --- borrador --- */
    totBorradorDebe() { return redondear((this.borrador?.lineas || []).reduce((s, l) => s + (Number(l.debe) || 0), 0)); },
    totBorradorHaber() { return redondear((this.borrador?.lineas || []).reduce((s, l) => s + (Number(l.haber) || 0), 0)); },
    borradorCuadra() {
      return this.totBorradorDebe > 0 && Math.abs(this.totBorradorDebe - this.totBorradorHaber) < 0.005;
    },

    /* --- RF07 mayorización automática --- */
    mayor() {
      const libros = {};
      for (const a of this.asientosPeriodo) {
        for (const l of a.lineas) {
          const t = tipoDe(l.codigo); if (!t) continue;
          const lib = libros[l.codigo] ||= {
            codigo:l.codigo, nombre:this.nombreCuenta(l.codigo), tipo:t.nombre, natural:t.natural,
            movimientos:[], totalDebe:0, totalHaber:0, saldo:0
          };
          lib.totalDebe = redondear(lib.totalDebe + (Number(l.debe) || 0));
          lib.totalHaber = redondear(lib.totalHaber + (Number(l.haber) || 0));
          const bruto = t.natural === 'Deudora'
            ? lib.totalDebe - lib.totalHaber
            : lib.totalHaber - lib.totalDebe;
          lib.saldo = redondear(bruto);
          lib.movimientos.push({
            fecha:a.fecha, numero:a.numero, concepto:l.detalle || a.concepto,
            debe:Number(l.debe) || 0, haber:Number(l.haber) || 0, acumulado:lib.saldo
          });
        }
      }
      return Object.values(libros).sort((a, b) => a.codigo.localeCompare(b.codigo));
    },
    mayorFiltrado() {
      const q = this.filtros.mayor.toLowerCase();
      return this.mayor.filter(m =>
        (!q || m.codigo.includes(q) || m.nombre.toLowerCase().includes(q)) &&
        (!this.filtros.mayorTipo || m.codigo[0] === this.filtros.mayorTipo));
    },

    /* --- RF09 estado de resultados --- */
    res() {
      const porGrupo = d => this.mayor.filter(m => m.codigo[0] === d && Math.abs(m.saldo) > 0.004)
                                     .map(m => ({ codigo:m.codigo, nombre:m.nombre, saldo:m.saldo }));
      const detIngresos = porGrupo('5'), detGastos = porGrupo('4');
      const ingresos = redondear(detIngresos.reduce((s, c) => s + c.saldo, 0));
      const costosGastos = redondear(detGastos.reduce((s, c) => s + c.saldo, 0));
      const utilidad = redondear(ingresos - costosGastos);
      return {
        detIngresos, detGastos, ingresos, costosGastos, utilidad,
        margen: ingresos ? (utilidad / ingresos * 100).toFixed(1) + '%' : '—'
      };
    },

    /* --- RF08 balance general --- */
    bal() {
      const porGrupo = d => this.mayor.filter(m => m.codigo[0] === d && Math.abs(m.saldo) > 0.004)
                                     .map(m => ({ codigo:m.codigo, nombre:m.nombre, saldo:m.saldo }));
      const activos = porGrupo('1'), pasivos = porGrupo('2'), capital = porGrupo('3');
      const suma = l => redondear(l.reduce((s, c) => s + c.saldo, 0));
      const activo = suma(activos), pasivo = suma(pasivos);
      const capitalTotal = redondear(suma(capital) + this.res.utilidad);
      return { activos, pasivos, capital, activo, pasivo, capitalTotal,
               cuadra: Math.abs(activo - pasivo - capitalTotal) < 0.01 };
    },

    /* --- gráficas --- */
    grafMeses() {
      const meses = {};
      for (const a of this.asientosPeriodo) {
        const k = a.fecha.slice(0, 7);
        const m = meses[k] ||= { ing:0, gas:0 };
        for (const l of a.lineas) {
          if (l.codigo[0] === '5') m.ing += (Number(l.haber) || 0) - (Number(l.debe) || 0);
          if (l.codigo[0] === '4') m.gas += (Number(l.debe) || 0) - (Number(l.haber) || 0);
        }
      }
      const claves = Object.keys(meses).sort().slice(-8);
      if (!claves.length) return [];
      const max = Math.max(...claves.map(k => Math.max(meses[k].ing, meses[k].gas)), 1);
      const nombres = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const paso = 460 / claves.length, w = Math.min(22, paso / 2.6);
      return claves.map((k, i) => {
        const m = meses[k], hI = Math.max(0, m.ing / max * 160), hG = Math.max(0, m.gas / max * 160);
        return { x: 50 + i * paso + (paso - w * 2 - 3) / 2, w,
                 hIng:hI, yIng:200 - hI, hGas:hG, yGas:200 - hG,
                 et: nombres[Number(k.slice(5, 7)) - 1] };
      });
    },
    grafEjeY() {
      if (!this.grafMeses.length) return [];
      const tope = this.grafTope;
      return [0, 0.5, 1].map(p => ({
        y: 204 - p * 160,
        et: tope >= 1000 ? Math.round(tope * p / 1000) + 'k' : Math.round(tope * p)
      }));
    },
    grafTope() {
      let max = 0;
      const meses = {};
      for (const a of this.asientosPeriodo) {
        const k = a.fecha.slice(0, 7); const m = meses[k] ||= { ing:0, gas:0 };
        for (const l of a.lineas) {
          if (l.codigo[0] === '5') m.ing += (Number(l.haber) || 0) - (Number(l.debe) || 0);
          if (l.codigo[0] === '4') m.gas += (Number(l.debe) || 0) - (Number(l.haber) || 0);
        }
      }
      for (const k in meses) max = Math.max(max, meses[k].ing, meses[k].gas);
      return max || 1;
    },
    grafResultado() {
      const d = [
        { et:'Ingresos', v:this.res.ingresos, color:'#2f6b46' },
        { et:'Gastos',   v:this.res.costosGastos, color:'#a3321f' },
        { et:'Resultado',v:Math.abs(this.res.utilidad), color:'#123b34' },
      ];
      const max = Math.max(...d.map(x => x.v), 1);
      return d.map((x, i) => {
        const h = x.v / max * 110;
        return { ...x, x: 30 + i * 90, w:58, h, y:135 - h,
                 val: x.v >= 1000 ? '$' + Math.round(x.v / 1000) + 'k' : '$' + Math.round(x.v) };
      });
    }
  },

  methods: {
    dinero, clasificar(c) { return tipoDe(c)?.nombre || ''; },
    naturaleza(c) { return tipoDe(c)?.natural || ''; },
    nombreCuenta(cod) { return this.cuentas.find(c => c.codigo === cod)?.nombre || 'Cuenta no catalogada'; },
    totalAsiento(a) { return redondear(a.lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0)); },
    saldoCuenta(cod) { return this.mayor.find(m => m.codigo === cod)?.saldo || 0; },
    puede(accion) {
      if (!this.sesion) return false;
      if (this.sesion.rol === 'admin') return true;
      return accion === 'consultar';
    },
    ir(v) { this.vista = v; if (v === 'nuevo' && !this.borrador) this.nuevoBorrador(); },
    periodoCompleto() { this.periodo.desde = '2026-01-01'; this.periodo.hasta = hoyISO(); },
    avisar(texto, tipo) {
      this.brindis = { texto, tipo };
      clearTimeout(this._t); this._t = setTimeout(() => this.brindis = null, 3200);
    },
    anotar(accion, detalle) {
      this.auditoria.unshift({ cuando:sello(), usuario:this.sesion?.usuario || '—', accion, detalle });
      this.auditoria = this.auditoria.slice(0, 200);
    },

    /* ---- RF01 seguridad ---- */
    async entrar() {
      const u = this.usuarios.find(x => x.usuario.toLowerCase() === this.login.usuario.toLowerCase());
      if (!u) { this.login.error = 'Ese usuario no existe. Revisa cómo lo escribiste.'; return; }
      const h = await hashear(this.login.clave, u.sal);
      if (h !== u.hash) { this.login.error = 'La contraseña no coincide. Inténtalo de nuevo.'; return; }
      this.sesion = { id:u.id, usuario:u.usuario, nombre:u.nombre, rol:u.rol };
      this.login = { usuario:'', clave:'', error:'' };
      this.vista = 'dashboard';
      this.anotar('Inicio de sesión', u.nombre + ' entró al sistema');
    },
    salir() { this.anotar('Cierre de sesión', this.sesion.nombre + ' salió'); this.sesion = null; },

    /* ---- RF03 catálogo ---- */
    abrirCuenta(c) {
      this.modalCuenta = c ? { ...c, error:'' } : { codigo:'', nombre:'', estado:'Activa', error:'' };
    },
    guardarCuenta() {
      const m = this.modalCuenta;
      m.error = '';
      if (!/^\d{3,6}$/.test(m.codigo)) { m.error = 'El código debe tener de 3 a 6 dígitos, por ejemplo 1101.'; return; }
      if (!tipoDe(m.codigo)) { m.error = 'El primer dígito debe ser 1, 2, 3, 4 o 5 para poder clasificar la cuenta.'; return; }
      if (!m.nombre || m.nombre.length < 3) { m.error = 'Escribe el nombre de la cuenta.'; return; }
      if (this.cuentas.some(c => c.codigo === m.codigo && c.id !== m.id)) { m.error = 'Ya existe una cuenta con ese código.'; return; }
      if (m.id) {
        const i = this.cuentas.findIndex(c => c.id === m.id);
        this.cuentas[i] = { id:m.id, codigo:m.codigo, nombre:m.nombre, estado:m.estado };
        this.anotar('Cuenta editada', m.codigo + ' ' + m.nombre);
        this.avisar('Cuenta actualizada');
      } else {
        this.cuentas.push({ id:uid(), codigo:m.codigo, nombre:m.nombre, estado:m.estado });
        this.anotar('Cuenta creada', m.codigo + ' ' + m.nombre);
        this.avisar('Cuenta agregada al catálogo');
      }
      this.modalCuenta = null;
    },
    borrarCuenta(c) {
      if (this.asientos.some(a => a.lineas.some(l => l.codigo === c.codigo))) {
        this.avisar('No se puede eliminar: la cuenta tiene movimientos. Márcala como inactiva.', 'error');
        return;
      }
      if (!confirm('¿Eliminar la cuenta ' + c.codigo + ' ' + c.nombre + '?')) return;
      this.cuentas = this.cuentas.filter(x => x.id !== c.id);
      this.anotar('Cuenta eliminada', c.codigo + ' ' + c.nombre);
      this.avisar('Cuenta eliminada');
    },

    /* ---- RF04 y RF05 libro diario con partida doble ---- */
    nuevoBorrador() {
      this.errores = [];
      this.borrador = {
        fecha: hoyISO(), concepto: '',
        lineas: [ { codigo:'', detalle:'', debe:0, haber:0 }, { codigo:'', detalle:'', debe:0, haber:0 } ]
      };
    },
    agregarLinea() { this.borrador.lineas.push({ codigo:'', detalle:'', debe:0, haber:0 }); },
    quitarLinea(i) { if (this.borrador.lineas.length > 2) this.borrador.lineas.splice(i, 1); },
    guardarAsiento() {
      const b = this.borrador, e = [];
      if (!b.fecha) e.push('Indica la fecha del asiento.');
      if (!b.concepto || b.concepto.length < 4) e.push('Escribe un concepto que explique la operación.');
      const utiles = b.lineas.filter(l => l.codigo && ((Number(l.debe) || 0) > 0 || (Number(l.haber) || 0) > 0));
      if (utiles.length < 2) e.push('Un asiento necesita al menos dos cuentas con importe.');
      b.lineas.forEach((l, i) => {
        const d = Number(l.debe) || 0, h = Number(l.haber) || 0;
        if (l.codigo && d === 0 && h === 0) e.push('La línea ' + (i + 1) + ' no tiene importe.');
        if (!l.codigo && (d > 0 || h > 0)) e.push('La línea ' + (i + 1) + ' tiene importe pero no tiene cuenta.');
        if (d > 0 && h > 0) e.push('La línea ' + (i + 1) + ' no puede llevar debe y haber a la vez.');
        if (d < 0 || h < 0) e.push('La línea ' + (i + 1) + ' tiene un importe negativo.');
      });
      if (!this.borradorCuadra) {
        e.push('El debe (' + dinero(this.totBorradorDebe) + ') no iguala al haber (' +
               dinero(this.totBorradorHaber) + '). La partida doble no se cumple.');
      }
      this.errores = [...new Set(e)];
      if (this.errores.length) { this.avisar('Corrige los datos señalados', 'error'); return; }

      const numero = this.siguienteNumero;
      this.asientos.push({
        id: uid(), numero, fecha: b.fecha, concepto: b.concepto,
        lineas: utiles.map(l => ({ codigo:l.codigo, detalle:l.detalle || '', debe:redondear(l.debe), haber:redondear(l.haber) })),
        registradoPor: this.sesion.usuario, registradoEn: sello()
      });
      this.anotar('Asiento registrado', 'N.º ' + numero + ' por ' + dinero(this.totBorradorDebe));
      this.avisar('Asiento n.º ' + numero + ' guardado. El mayor y los estados ya lo incluyen.');
      this.nuevoBorrador();
    },
    borrarAsiento(a) {
      if (!confirm('¿Eliminar el asiento n.º ' + a.numero + '? El mayor y los estados se recalculan.')) return;
      this.asientos = this.asientos.filter(x => x.id !== a.id);
      this.anotar('Asiento eliminado', 'N.º ' + a.numero + ' — ' + a.concepto);
      this.avisar('Asiento eliminado');
    },

    /* ---- RF02 usuarios ---- */
    abrirUsuario(u) {
      this.modalUsuario = u
        ? { ...u, clave:'', error:'' }
        : { usuario:'', nombre:'', rol:'usuario', clave:'', error:'' };
    },
    async guardarUsuario() {
      const m = this.modalUsuario;
      m.error = '';
      if (!/^[a-zA-Z0-9._-]{3,20}$/.test(m.usuario)) { m.error = 'El usuario admite de 3 a 20 letras, números, punto, guion o guion bajo.'; return; }
      if (!m.nombre || m.nombre.length < 3) { m.error = 'Escribe el nombre completo.'; return; }
      if (this.usuarios.some(u => u.usuario.toLowerCase() === m.usuario.toLowerCase() && u.id !== m.id)) {
        m.error = 'Ese usuario ya está ocupado.'; return;
      }
      if (!m.id && m.clave.length < 6) { m.error = 'La contraseña necesita al menos 6 caracteres.'; return; }
      if (m.id && m.clave && m.clave.length < 6) { m.error = 'La contraseña nueva necesita al menos 6 caracteres.'; return; }

      if (m.id) {
        const u = this.usuarios.find(x => x.id === m.id);
        u.usuario = m.usuario; u.nombre = m.nombre; u.rol = m.rol;
        if (m.clave) { u.sal = uid(); u.hash = await hashear(m.clave, u.sal); }
        this.anotar('Usuario editado', m.usuario);
        this.avisar('Usuario actualizado');
      } else {
        const sal = uid();
        this.usuarios.push({ id:uid(), usuario:m.usuario, nombre:m.nombre, rol:m.rol,
                             sal, hash: await hashear(m.clave, sal), creado: hoyISO() });
        this.anotar('Usuario creado', m.usuario + ' con rol ' + m.rol);
        this.avisar('Usuario agregado');
      }
      this.modalUsuario = null;
    },
    borrarUsuario(u) {
      if (u.id === this.sesion.id) return;
      if (this.usuarios.filter(x => x.rol === 'admin').length === 1 && u.rol === 'admin') {
        this.avisar('Debe quedar al menos un administrador.', 'error'); return;
      }
      if (!confirm('¿Eliminar al usuario ' + u.usuario + '?')) return;
      this.usuarios = this.usuarios.filter(x => x.id !== u.id);
      this.anotar('Usuario eliminado', u.usuario);
      this.avisar('Usuario eliminado');
    },

    /* ---- RF12 reportes ---- */
    imprimir() { window.print(); },
    exportar() {
      const filas = [];
      const num = n => redondear(n).toFixed(2);
      if (this.vista === 'catalogo') {
        filas.push(['Código','Nombre','Clasificación','Naturaleza','Estado','Saldo']);
        this.cuentasFiltradas.forEach(c => filas.push([c.codigo, c.nombre, this.clasificar(c.codigo),
          this.naturaleza(c.codigo), c.estado, num(this.saldoCuenta(c.codigo))]));
      } else if (this.vista === 'diario') {
        filas.push(['Asiento','Fecha','Concepto','Código','Cuenta','Debe','Haber']);
        this.diarioFiltrado.forEach(a => a.lineas.forEach(l =>
          filas.push([a.numero, a.fecha, a.concepto, l.codigo, this.nombreCuenta(l.codigo), num(l.debe), num(l.haber)])));
      } else if (this.vista === 'mayor') {
        filas.push(['Código','Cuenta','Fecha','Asiento','Concepto','Debe','Haber','Saldo']);
        this.mayorFiltrado.forEach(m => m.movimientos.forEach(mv =>
          filas.push([m.codigo, m.nombre, mv.fecha, mv.numero, mv.concepto, num(mv.debe), num(mv.haber), num(mv.acumulado)])));
      } else if (this.vista === 'balance') {
        filas.push(['Grupo','Código','Cuenta','Saldo']);
        this.bal.activos.forEach(c => filas.push(['Activo', c.codigo, c.nombre, num(c.saldo)]));
        this.bal.pasivos.forEach(c => filas.push(['Pasivo', c.codigo, c.nombre, num(c.saldo)]));
        this.bal.capital.forEach(c => filas.push(['Capital', c.codigo, c.nombre, num(c.saldo)]));
        filas.push(['Capital','','Resultado del período', num(this.res.utilidad)]);
        filas.push(['Totales','','Activo / Pasivo + Capital', num(this.bal.activo) + ' / ' + num(this.bal.pasivo + this.bal.capitalTotal)]);
      } else {
        filas.push(['Grupo','Código','Cuenta','Importe']);
        this.res.detIngresos.forEach(c => filas.push(['Ingresos', c.codigo, c.nombre, num(c.saldo)]));
        this.res.detGastos.forEach(c => filas.push(['Costos y gastos', c.codigo, c.nombre, num(c.saldo)]));
        filas.push(['Resultado','','Utilidad o pérdida', num(this.res.utilidad)]);
      }
      const csv = '\uFEFF' + filas.map(f => f.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
      a.download = this.vista + '-' + this.periodo.hasta + '.csv';
      a.click(); URL.revokeObjectURL(a.href);
      this.avisar('Archivo descargado. Se abre en Excel.');
    },

    /* ---- respaldo ---- */
    respaldar() {
      disco.escribir({ usuarios:this.usuarios, cuentas:this.cuentas, asientos:this.asientos, auditoria:this.auditoria });
    }
  },

  watch: {
    usuarios:  { handler:'respaldar', deep:true },
    cuentas:   { handler:'respaldar', deep:true },
    asientos:  { handler:'respaldar', deep:true },
    auditoria: { handler:'respaldar', deep:true }
  },

  async mounted() {
    const guardado = await disco.leer();
    if (guardado && guardado.usuarios?.length) {
      Object.assign(this, guardado);
    } else {
      const s1 = uid(), s2 = uid();
      this.usuarios = [
        { id:uid(), usuario:'admin', nombre:'Ana Portillo', rol:'admin',
          sal:s1, hash: await hashear('admin123', s1), creado:'2026-01-01' },
        { id:uid(), usuario:'contador', nombre:'Luis Menjívar', rol:'usuario',
          sal:s2, hash: await hashear('user123', s2), creado:'2026-01-05' },
      ];
      this.cuentas = CATALOGO;
      this.asientos = ASIENTOS.map((a, i) => ({
        id: uid(), numero: i + 1, fecha: a.fecha, concepto: a.concepto,
        lineas: a.lineas.map(([codigo, detalle, debe, haber]) => ({ codigo, detalle, debe, haber })),
        registradoPor: 'admin', registradoEn: a.fecha
      }));
    }
    this.nuevoBorrador();
  }
}).mount('#app');
