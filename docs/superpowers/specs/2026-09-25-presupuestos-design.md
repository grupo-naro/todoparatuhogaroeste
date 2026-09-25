# Presupuestos: cotización imprimible sin persistencia

## Contexto y objetivo

Las vendedoras arman la mayoría de las ventas desde el celular. El flujo de
armar el carrito ya es cómodo en mobile (`/ventas/nueva`); el problema es
que hoy no existe forma de darle a un cliente un precio antes de que
confirme la compra — toda venta descuenta stock y queda registrada de
inmediato. Se necesita poder armar la misma lista de productos, mostrar un
total, e imprimirlo como presupuesto, sin que eso toque stock ni cree
nada en la base de datos.

## Alcance

### Dentro de alcance

1. Un modo "Presupuesto" dentro de la pantalla `/ventas/nueva` existente
   (toggle Venta/Presupuesto), no una pantalla nueva.
2. El presupuesto usa exclusivamente productos ya cargados en el
   catálogo — misma búsqueda que ya existe para ventas
   (`searchSellableVariantsAction`). Sin ítems libres/a medida en esta
   iteración.
3. Precio fijo al cargado en el producto (igual que en una venta — no se
   edita a mano).
4. Teléfono/nombre del cliente opcionales, reutilizando la búsqueda por
   teléfono que ya existe en `SaleCart` (autocompleta el nombre si el
   cliente ya está registrado). Solo aparecen impresos — **nunca se crea
   ni se vincula un `Customer`**, porque el presupuesto no persiste nada.
5. Al "generar" el presupuesto no hay ninguna llamada al servidor: se
   muestra una vista imprimible en el cliente y se dispara
   `window.print()`, igual que ya hace `SaleReceipt` al crear una venta.
6. Texto fijo al pie del presupuesto impreso: *"Presupuesto sin cargo.
   Precios y stock sujetos a confirmación al momento de la compra."*

### Fuera de alcance (esta iteración)

Ítems libres/a medida sin producto de catálogo, persistencia/historial de
presupuestos, convertir un presupuesto en venta automáticamente, precio
editable por línea, fecha de vencimiento calculada, envío por WhatsApp/email,
página o rol distintos a los que ya usan `/ventas/nueva` (sigue siendo
`ADMIN` + `VENDEDOR`, sin cambios de guard).

## Arquitectura

### Modo Venta/Presupuesto — `src/components/ventas/SaleCart.tsx` (modificado)

Nuevo estado local, sin tocar nada del servidor:

```ts
const [mode, setMode] = useState<'venta' | 'presupuesto'>('venta')
const [showQuote, setShowQuote] = useState(false)
```

- Un toggle de dos botones ("Venta" / "Presupuesto") arriba de la búsqueda
  de productos, mismo patrón visual que `PeriodSelector` (botones con
  `aria-pressed`), pero sin URL — es estado de componente, no
  querystring, porque no tiene sentido deep-linkear ni persistir un modo
  de UI efímero (el carrito en sí tampoco sobrevive un refresh hoy).
- Cambiar el toggle en cualquier momento pone `showQuote` en `false` (si
  se estaba viendo un presupuesto ya generado, vuelve a la pantalla de
  armado) pero **nunca toca `cart`, `customerPhone` ni `customerName`** —
  el modo no borra lo que ya se cargó.
- El selector de método de pago (`<Select aria-label="Método de pago">`)
  se envuelve en `{mode === 'venta' && (...)}`— no se muestra en modo
  Presupuesto.
- El botón final cambia texto y `onClick` según `mode`:
  - `venta`: sin cambios — `handleConfirm` llama `createSale` como hoy.
  - `presupuesto`: `onClick={() => setShowQuote(true)}`, texto "Generar
    presupuesto", mismo `disabled={cart.length === 0}` que ya tiene.
- Cuando `showQuote` es `true`, el componente renderiza `<QuoteReceipt>`
  **en vez de** todo el bloque de armado de carrito (búsqueda, lista,
  teléfono, método de pago, botón) — no como superposición.

```tsx
const quoteCustomerName = matchedCustomer?.name || customerName.trim() || undefined

if (showQuote) {
  return (
    <QuoteReceipt
      lines={cart}
      total={total}
      customerName={quoteCustomerName}
      onNuevoPresupuesto={() => {
        setCart([]); setCustomerPhone(''); setCustomerName(''); setFoundCustomer(null)
        setShowQuote(false)
      }}
    />
  )
}
```

(`quoteCustomerName` resuelve al nombre real si matcheó un cliente
existente; si no, al nombre tipeado a mano *solo si ya se completó*
(`.trim()` no vacío); en cualquier otro caso —incluido teléfono cargado
pero nombre todavía vacío— queda `undefined` y no se muestra la línea
"Presupuesto para: ..." en el impreso, tal como dice la tabla de casos
límite más abajo.)

### `QuoteReceipt` — `src/components/ventas/QuoteReceipt.tsx` (nuevo)

Componente puramente presentacional — sin fetch, sin ruta, sin Server
Action. Recibe todo por props, directamente del estado ya en memoria de
`SaleCart`:

```ts
type QuoteLine = { variantId: string; productName: string; variantName: string; unitPrice: number | null; quantity: string }
export function QuoteReceipt({ lines, total, customerName, onNuevoPresupuesto }: {
  lines: QuoteLine[]; total: number; customerName?: string; onNuevoPresupuesto: () => void
}): JSX.Element
```

Visualmente calca `SaleReceipt.tsx` (logo, nombre del negocio, tabla de
productos con cantidad/precio unitario/subtotal, total al pie, mismas
clases `print:hidden`/`print:border-0` para que solo quede el contenido
relevante al imprimir) con estas diferencias:

- Título "Presupuesto" en vez de "Ticket N° ...", sin número (no hay
  ninguno, no persiste).
- Sin línea de vendedora ni de método de pago (no aplican a un
  presupuesto).
- Si `customerName` viene cargado, una línea "Presupuesto para:
  **{customerName}**" debajo del encabezado.
- El pie dice el texto fijo de la aclaración en vez de "Documento no
  válido como factura."
- Fuera del área imprimible (`print:hidden`), un botón "Nuevo
  presupuesto" que llama `onNuevoPresupuesto` (recibido como prop, no
  hace routing — `SaleCart` es quien decide qué pasa después).

Dispara la impresión una sola vez, al montarse (no hay ningún
`searchParams`/ruta que trackear como en `SaleReceipt`, porque no hay
navegación — el componente se monta exactamente cuando corresponde
imprimir):

```ts
useEffect(() => { window.print() }, [])
```

## Manejo de errores / casos límite

| Caso | Comportamiento |
|---|---|
| Carrito vacío | "Generar presupuesto" deshabilitado, igual que "Confirmar venta" hoy |
| Cambiar de modo con productos ya cargados | El carrito se mantiene, no se borra nada |
| Volver con "Nuevo presupuesto" | Vacía carrito + teléfono/nombre, vuelve a armar en modo Presupuesto |
| Tocar el toggle de modo mientras se ve un presupuesto generado | Vuelve a la pantalla de armado con el mismo carrito, sin reimprimir |
| Teléfono cargado pero sin nombre (cliente nuevo, no confirmó) | Igual que en Venta: el campo de nombre queda visible y vacío; si no se completa, `customerName` en el presupuesto impreso queda `undefined` y no se muestra la línea "Presupuesto para: ..." |

## Testing

Sigue las convenciones ya establecidas (RTL para componentes, sin base de
datos ya que no hay servidor involucrado):

- `src/components/ventas/SaleCart.test.tsx` (agregar casos): el toggle
  cambia el texto del botón de confirmar y oculta/muestra método de
  pago; en modo Presupuesto, "Generar presupuesto" muestra el contenido
  esperado (producto, cantidad, total) **sin llamar a `createSale`**
  (mock de `createSale` con `expect(createSale).not.toHaveBeenCalled()`);
  cambiar el carrito y después de modo no lo vacía; "Nuevo presupuesto"
  sí lo vacía y vuelve a la pantalla de armado.
- `src/components/ventas/QuoteReceipt.test.tsx` (nuevo): renderiza
  líneas/cantidades/precios/total correctos; muestra "Presupuesto para:
  {nombre}" solo si se pasa `customerName`; no muestra nada de vendedora
  ni método de pago; muestra el texto fijo del pie; llama a
  `window.print()` al montarse (mockeado con
  `vi.spyOn(window, 'print').mockImplementation(() => {})` — primer
  componente de este proyecto que imprime, así que esta es la convención
  que se establece acá para futuros componentes similares).
