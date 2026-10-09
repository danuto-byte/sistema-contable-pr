# Sistema Contable — Frontend (Vue 3)

Aplicación de una sola página: catálogo de cuentas, libro diario con validación de partida doble,
mayorización automática, balance general y estado de resultados.

## Cómo ejecutarlo

Abre `sistema-contable.html` en el navegador. No necesita instalación: Vue 3 se carga por CDN.
Los datos se guardan en el navegador y el archivo ya incluye un catálogo y siete asientos de ejemplo
para que los reportes se vean con contenido desde el primer momento.

Usuarios de prueba:

| Usuario    | Contraseña | Rol           |
|------------|------------|---------------|
| `admin`    | `admin123` | Administrador |
| `contador` | `user123`  | Consulta      |

## Cómo se cumple cada requisito

| Requisito | Dónde está |
|---|---|
| RF01 / RF02 Usuarios y roles | Pantalla de acceso, módulo Usuarios, método `puede()` |
| RF03 Catálogo de cuentas | Vista Catálogo, alta/edición con validación de código |
| RF04 Libro diario | Vista Nuevo asiento, líneas dinámicas de debe y haber |
| RF05 Partida doble | `borradorCuadra` y `guardarAsiento()`: no guarda si hay diferencia |
| RF06 Consulta del diario | Filtros por concepto, cuenta, número y rango de fechas |
| RF07 Mayorización automática | Computada `mayor`, agrupa por cuenta y acumula saldo |
| RF08 Balance general | Computada `bal`, grupos 1, 2 y 3 más el resultado del período |
| RF09 Estado de resultados | Computada `res`, grupo 5 menos grupo 4 |
| RF10 Clasificación automática | Constante `TIPOS` y función `tipoDe()` según el primer dígito |
| RF11 Consulta de estados | Vistas Balance general, Estado de resultados, Diario y Mayor |
| RF12 Reportes | Botones de impresión con hoja de estilo `@media print` y descarga en CSV para Excel |
| RNF02 Validaciones | Campos obligatorios, código de 3 a 6 dígitos, importes no negativos, un solo lado por línea |
| RNF03 Seguridad | Contraseñas con SHA-256 y sal por usuario (`hashear()`) |
| RNF04 Integridad | Ningún asiento descuadrado entra al arreglo `asientos` |
| RNF07 Mantenibilidad | Script dividido en cinco bloques: clasificación, utilidades, respaldo, datos, aplicación |

Extras incluidos: panel con la ecuación contable viva, gráficas de ingresos y gastos por mes,
filtros por período contable e historial de movimientos por usuario.

## Siguiente fase: backend

El frontend está listo para cambiar el respaldo local por llamadas HTTP. Los puntos de conexión
esperados son:

```
POST /api/auth/login          -> { token, usuario }
GET|POST|PUT|DELETE /api/usuarios
GET|POST|PUT|DELETE /api/cuentas
GET|POST|DELETE     /api/asientos        (el servidor revalida la partida doble)
GET /api/reportes/mayor?desde&hasta
GET /api/reportes/balance?hasta
GET /api/reportes/resultados?desde&hasta
```

En el servidor conviene repetir dos reglas que aquí ya están implementadas: rechazar el asiento cuando
la suma del debe no iguala a la del haber, y derivar la clasificación del primer dígito del código en
lugar de guardarla como campo editable. Las contraseñas deben pasar a bcrypt.
