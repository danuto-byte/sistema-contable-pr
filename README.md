# Sistema Contable

Aplicación web para organizar y consultar la actividad contable de un negocio. Reúne en un mismo lugar el catálogo de cuentas, el registro de operaciones y los reportes que ayudan a entender cómo evoluciona la situación financiera.

La interfaz está en español y busca que las tareas habituales —como revisar movimientos, registrar un asiento o consultar un balance— sean claras sin requerir conocimientos técnicos del sistema.

> **Importante:** esta copia incluye datos y usuarios de demostración. Está preparada para revisión y desarrollo; no debe considerarse por sí sola un servicio de producción ni utilizarse para guardar información financiera real.

## Qué permite hacer

- **Consultar el panel contable** y revisar cifras resumidas del período.
- **Organizar cuentas** por código, nombre y estado.
- **Registrar asientos** con varias líneas y validar que el debe y el haber coincidan antes de guardarlos.
- **Buscar movimientos** en el libro diario por fecha, concepto, cuenta o número.
- **Consultar el libro mayor**, con saldos calculados a partir de los movimientos.
- **Revisar el balance general y el estado de resultados** para el período elegido.
- **Imprimir reportes o descargarlos como CSV**, compatible con hojas de cálculo.
- **Administrar usuarios de demostración**, roles e historial de acciones.

La clasificación contable se obtiene del primer dígito del código: 1 para activos, 2 para pasivos, 3 para capital, 4 para costos y gastos, y 5 para ingresos.

## Probar la aplicación

### Abrir la interfaz

Abre `index.html` en un navegador con conexión a Internet. Vue se carga desde un CDN.

Usuarios de demostración:

| Usuario | Contraseña | Acceso |
|---|---|---|
| `admin` | `admin123` | Administración y registro |
| `contador` | `user123` | Consulta |

Al iniciar sin datos guardados, se muestran un catálogo y asientos de ejemplo para que los reportes tengan contenido. El almacenamiento de la interfaz depende de la disponibilidad de `window.storage` en el entorno donde se abre; si no está disponible, los cambios pueden mantenerse solo durante la sesión del navegador.

### Iniciar el servidor

El proyecto también incluye un servidor Node.js con Express y rutas de API. Para ejecutarlo localmente:

```bash
npm install
npm start
```

Por defecto, el servidor utiliza el puerto `3000`. Se puede comprobar que responde en `http://localhost:3000/api/health`.

La conexión a MongoDB es opcional y se configura mediante la variable `MONGODB_URI` (ver `.env.example`). En el estado actual, las rutas del servidor trabajan con datos de ejemplo en memoria: conectarse a MongoDB no significa que los registros de esta aplicación se estén guardando allí. Al reiniciar el proceso, los cambios en memoria se pierden.

## Estructura del proyecto

| Ruta | Contenido |
|---|---|
| `index.html` | Página principal de la aplicación |
| `src/app.js` | Interfaz, validaciones, cálculos y reportes |
| `src/estilos.css` | Presentación visual y estilos de impresión |
| `server/index.js` | Servidor Express y rutas de la API |
| `server/config/` | Configuración de la conexión opcional a MongoDB |
| `server/data/` | Datos de ejemplo utilizados por el servidor |
| `tests/` | Pruebas automatizadas de la API |
| `package.json` | Dependencias y comandos del proyecto |

## Código fuente y distribución

Esta carpeta contiene archivos editables de desarrollo —HTML, JavaScript y CSS— junto con el servidor, las pruebas y la configuración de dependencias. En esta copia no aparecen instaladores de Electron ni un archivo `app.asar`; por tanto, su contenido corresponde al código de la aplicación disponible aquí, no a una distribución empaquetada.

Para fines de mantenimiento, el punto de entrada de la interfaz es `index.html`; la lógica principal está en `src/app.js`. El servidor se inicia desde `server/index.js`.

La carpeta local no incluye historial de Git ni una referencia al repositorio remoto o al commit del que proviene. Por ello, aunque aquí se puede revisar y modificar código fuente, esta copia por sí sola no permite confirmar si es exactamente el repositorio usado para construir una distribución ni reconstruir su cadena de cambios. Para verificar esa relación, se requiere contrastarla con el repositorio de origen y su historial de versiones.

## Pruebas

Ejecuta las pruebas automatizadas con:

```bash
npm test
```

## Alcance actual

La interfaz mantiene su propia lógica y datos de demostración en el navegador. El servidor ofrece endpoints para autenticación, cuentas, asientos y reportes, pero la interfaz no está conectada a ellos de forma integral. Antes de utilizar el sistema con datos reales, se necesita completar esa integración y definir persistencia, controles de acceso, gestión segura de contraseñas, copias de respaldo y despliegue.
