# Impresión automática de ventas y presupuestos en el local

## Objetivo

Cada vez que se confirma una venta o se genera un presupuesto, el comprobante sale
solo en la impresora A4 del local, sin importar desde qué celular, tablet o computadora
se haya cargado. Hoy el sistema solo imprime en el mismo dispositivo que hace la venta.

## Decisiones tomadas

- Un solo punto de impresión: una computadora del local (Windows + Chrome) con la impresora A4 como predeterminada.
- Los presupuestos hoy no se guardan; para poder imprimirlos en otra máquina se guardan temporalmente (7 días) en la cola de impresión.
- Los celulares y tablets dejan de imprimir solos. Queda el botón "Imprimir" manual en cada comprobante.
- Las anulaciones de venta no se imprimen.

## Cómo funciona

1. **Cola de impresión:** nueva tabla `PrintJob`. Al confirmar una venta (`createSale`) se crea un trabajo `VENTA` dentro de la misma transacción que la venta. Al generar un presupuesto se llama a una acción nueva que crea un trabajo `PRESUPUESTO` con una copia de los datos.
2. **Estación de impresión:** pantalla `/impresion` que abre la PC del local. Consulta cada 5 segundos si hay trabajos pendientes, imprime cada comprobante en orden y lo marca como impreso.
3. **Impresión silenciosa:** la PC abre Chrome con `--kiosk-printing` apuntando a la estación, así `window.print()` manda directo a la impresora predeterminada sin cuadro de diálogo.
4. **Sin sesión de usuario:** la estación se autentica con una clave propia (`PRINT_STATION_KEY`), no con el login. Las sesiones duran 8 horas; si la estación dependiera de ellas se cortaría sola a mitad del día.

## Datos

`PrintJob`

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | |
| kind | enum `VENTA` / `PRESUPUESTO` | |
| saleId | uuid, opcional | solo `VENTA`; FK a `Sale` con borrado en cascada |
| payload | json, opcional | solo `PRESUPUESTO`: líneas, total, nombre del cliente, fecha de emisión |
| createdAt | datetime | |
| printedAt | datetime, opcional | |

Índice por (`printedAt`, `createdAt`). Hace falta una migración de Prisma.

El presupuesto toma los precios desde la base de datos al encolarse (no desde lo que mande el navegador), con la misma regla de precio efectivo que usa la venta. Si alguna línea no tiene precio, no se encola (igual que hoy no deja generarlo).

## Endpoints de la estación

Todos exigen el header `x-print-key` igual a `PRINT_STATION_KEY` (comparación en tiempo constante). Sin clave o con clave incorrecta responden 401. Se agregan `/impresion` y `/api/impresion` a las rutas públicas de `proxy.ts`, porque no usan la sesión.

- `GET /api/impresion/pendientes`: trabajos sin imprimir creados en las últimas 12 horas, del más viejo al más nuevo, máximo 10. Devuelve, por trabajo, los datos ya listos para dibujar el comprobante (para ventas, el detalle de la venta; para presupuestos, el `payload`).
- `POST /api/impresion/marcar` con `{ id }`: marca `printedAt` si todavía no estaba marcado. Es idempotente.

## Pantalla `/impresion`

- Lee la clave de la dirección (`?clave=...`) y la usa en cada request.
- Muestra el estado: "Conectada · última revisión hh:mm:ss", cantidad impresa en esta sesión, y un aviso rojo si falla la conexión.
- Cada trabajo se imprime una sola vez por pestaña (se recuerda en memoria el id), de a uno, y recién después de imprimir se marca como impreso.
- Reutiliza los mismos documentos que las pantallas de comprobante (`SaleDocument`, `QuoteDocument`), extraídos de `SaleReceipt` y `QuoteReceipt`, con `@page { size: A4; margin: 0 }` y padding interno para que Chrome no agregue encabezado ni pie con la URL.

## Cambios en lo existente

- `createSale`: crea el `PrintJob` en la misma transacción.
- `SaleCart`: al generar un presupuesto llama a la acción que encola el trabajo antes de mostrar el comprobante.
- `SaleReceipt` y `QuoteReceipt`: se quita la impresión automática local. El botón "Imprimir" manual se mantiene.
- Limpieza: al encolar, se borran los trabajos de más de 7 días.

## Instalación en el local (se documenta en el README)

1. Dejar la impresora A4 como predeterminada en Windows.
2. Crear un acceso directo a Chrome: `chrome.exe --kiosk-printing --app="https://<sitio>/impresion?clave=<PRINT_STATION_KEY>"`.
3. Abrirlo al iniciar la PC y no cerrarlo durante el horario de atención.
4. Cargar `PRINT_STATION_KEY` en Netlify y en `.env`.

## Errores y bordes

- PC apagada o sin internet: los trabajos esperan; al volver se imprimen los de las últimas 12 horas. Los más viejos se descartan para no imprimir una pila vieja.
- Falla la impresora: el trabajo no se marca como impreso y se reintenta en la próxima revisión.
- Dos estaciones abiertas a la vez imprimirían dos veces el mismo comprobante. Se documenta que debe haber una sola.
- Un trabajo de venta cuya venta fue anulada antes de imprimirse se imprime igual, mostrando la leyenda "Venta anulada" que ya existe en el comprobante.

## Pruebas

- Con base de datos: `createSale` crea el trabajo en la misma transacción y no lo deja si la venta falla; la acción de presupuesto calcula precios desde la base y rechaza líneas sin precio; limpieza de trabajos viejos.
- Endpoints: 401 sin clave o con clave incorrecta; `pendientes` excluye impresos y los de más de 12 horas, respeta el orden y el máximo; `marcar` es idempotente.
- Componente de la estación (con `fetch` y `window.print` mockeados): imprime cada trabajo una sola vez, marca solo después de imprimir, y muestra el error de conexión.

## Fuera de alcance

- Ticketera térmica (58 u 80 mm).
- Botón de reimpresión desde el sistema.
- Varias estaciones o varias impresoras.
- Imprimir anulaciones de venta.
