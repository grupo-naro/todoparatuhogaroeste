# Reservas — diseño

Fecha: 2026-10-24. Estado: borrador para aprobación.

## Para qué

En el local pasa seguido que una clienta quiere un producto que no está en stock, o una combinación donde una parte sí está y otra no (la mesa está, las sillas de terciopelo verde no). Hoy no hay forma de decir "guardame esto". La clienta se va sin llevarse nada, o se lleva la mesa y vuelve por las sillas.

Una **reserva** aparta lo que hay y deja anotado lo que falta, a nombre de una clienta, con o sin seña. Cuando todo está disponible, el sistema avisa al local y la reserva se convierte en una venta normal.

Casos reales que tiene que cubrir:

1. **Mesa en stock + sillas sin stock.** La clienta deja la mesa guardada hasta que lleguen las sillas y se lleva todo junto.
2. **Un solo producto sin stock** (sillón negro, hoy sólo hay verde, rojo y blanco). La clienta lo pide en negro y se lo reservan para cuando entre.
3. **Con seña o sin seña.** Algunas clientas dejan plata, otras no dejan nada y la reserva igual se guarda.

## Objetivos

- Reservar uno o varios productos para una clienta, estén o no en stock.
- Lo apartado deja de ofrecerse para la venta, pero **sigue contado en el depósito**: no se descuenta stock hasta que la clienta se lo lleva.
- Cuando se repone stock de un producto con reservas esperando, el sistema lo aparta solo.
- Registrar señas (una o varias) como plata cobrada, bien aclaradas y separadas de las ventas.
- Convertir la reserva en venta descontando la seña ya cobrada.
- Cancelar una reserva: la vendedora decide si devuelve la seña o la retiene.
- Liberación automática opcional, configurable por el admin.
- Uso cómodo desde celular y tablet.

## No objetivos

- No manda mensajes automáticos a la clienta. El local la llama o le escribe.
- No hay entrega parcial: la reserva se concreta completa.
- No hay edición de una reserva ya creada (cambiar productos o cantidades): se cancela y se crea otra. Pendiente de confirmar si hace falta, ver "Decisiones tomadas".
- No hay reservas de productos que no existen en el sistema: el producto y su variante tienen que estar cargados.
- No cambia el catálogo público más que lo necesario para no ofrecer lo reservado.

## Lo que decidió Nahuel

- Una reserva es una lista de productos de una clienta. Cada producto está **apartado** o **esperando que llegue**.
- Lo reservado no se descuenta del stock, sigue en el depósito, pero deja de estar disponible para vender.
- Seña opcional. La plata de la seña se cuenta como ingreso, **aclarando que es seña**.
- Cuando se repone stock de un producto reservado, **lo aplica el sistema solo**, no la vendedora.
- Liberación automática: se activa y configura desde el panel del administrador (interruptor + cantidad de días). Los días corren **desde que la reserva queda lista**, es decir, desde que llegó todo lo que faltaba.
- Al cancelar, **la vendedora decide** si se devuelve la seña o se retiene, según el caso.
- Si el precio de un producto cambió entre la reserva y el retiro, **lo decide la vendedora caso por caso**: cobra el precio de la reserva o el precio actual.
- Al crear una reserva se imprimen **dos comprobantes**: uno para la clienta y una copia para el depósito, que se pega en el producto reservado para que se sepa que ya tiene dueña.

## Decisiones tomadas por el diseño (para revisar)

Son supuestos míos. No los dijo Nahuel con esas palabras.

1. **Orden de llegada.** Si hay varias reservas esperando el mismo producto, el stock repuesto se aparta primero a la más antigua. Si no alcanza, se cubren las primeras y el resto sigue esperando. Una reserva puede quedar cubierta a medias.
2. **Aviso sólo en el local.** Las reservas que quedan listas aparecen en un aviso del dashboard, en el menú y en la lista de Reservas. En el detalle hay un botón "Avisar por WhatsApp" que abre WhatsApp con un mensaje armado (el sistema ya tiene `src/lib/whatsapp.ts`). La reserva queda marcada como "clienta avisada".
3. **Convertir en venta sólo cuando está lista.** No se puede concretar con productos todavía esperando.
4. **Vencida con seña.** La liberación automática no puede preguntarle nada a la vendedora. Cuando una reserva con seña vence, queda en estado "seña sin resolver" y aparece en la lista hasta que una vendedora o el admin elija devolver o retener. Hasta entonces la plata sigue contada como cobrada.
5. **Vigencia perezosa.** Las reservas vencidas se liberan al consultar las reservas, el depósito y las ventas, sin depender de un proceso programado. Se puede sumar un programado más adelante.
6. **Vendedoras ven sólo sus reservas.** Igual que con las ventas: la vendedora ve y gestiona las suyas, el admin ve todas.
7. **El depósito ve lo reservado.** El rol Depósito ve cuántas unidades están reservadas para no sacarlas, y al ingresar stock dispara el apartado automático.
8. **Bajar stock no puede dejar reservas al aire.** Si alguien ajusta el stock a menos de lo apartado, el sistema lo rechaza e indica cuántas unidades están reservadas.
9. **Anular una venta que devuelve stock** también dispara el apartado a reservas que esperan.

## Modelo de datos

Estados de la reserva: `ESPERANDO` (algo falta llegar), `LISTA` (todo apartado), `CONCRETADA` (se convirtió en venta), `CANCELADA`, `VENCIDA`.

- **Reservation**: número correlativo, vendedora que la creó, clienta (opcional, como en ventas: nombre y teléfono; el teléfono es lo que permite avisar), estado, nota, fecha de creación, fecha en que quedó lista, fecha de cierre, venta resultante (si se concretó), si la clienta fue avisada y cuándo, y cómo se resolvió la seña al cerrar.
- **ReservationItem**: reserva, variante, cantidad pedida, cantidad ya apartada, precio unitario del día de la reserva.
- **ReservationPayment**: reserva, monto, método de pago (efectivo, tarjeta, transferencia), tipo (`SENA` o `DEVOLUCION`), quién lo registró, fecha.
- **Sale**: nuevo campo `depositApplied` (seña descontada al concretar). Sin seña vale 0.
- **StoreSettings**: una sola fila con `reservationExpiryEnabled` (por defecto apagado) y `reservationExpiryDays`.

**Stock disponible para vender** = stock del depósito − unidades apartadas en reservas abiertas. El stock del depósito (`InventoryStock`) no cambia al reservar: sólo cambia cuando se concreta la venta.

## Cómo se comporta

**Crear.** La vendedora elige productos y cantidades igual que en una venta, con cliente opcional y seña opcional. Al guardar, por cada producto se aparta lo que haya disponible, hasta la cantidad pedida. Lo que no alcanza queda esperando. Si no falta nada, la reserva nace `LISTA`.

**Reposición.** Cada vez que sube el stock de una variante (ajuste del depósito, ingreso, anulación de una venta), el sistema reparte las unidades nuevas entre las reservas que esperan esa variante, de la más antigua a la más nueva. Si una reserva se completa, pasa a `LISTA`, se guarda la fecha y aparece en los avisos.

**Seña.** Se puede registrar al crear o después, varias veces. Cada seña es un ingreso con su método de pago.

**Precio al concretar.** Si ningún precio cambió, no hay nada que elegir. Si alguno cambió, la vendedora ve los dos precios (el de la reserva y el actual) y elige cuál cobrar. No hay una opción por defecto: tiene que elegir. Se aplica a toda la reserva.

**Imprimir.** Al crear la reserva se encolan dos impresiones en la estación del local, igual que las ventas y los presupuestos:
- **Comprobante de la clienta**, con el formato del formulario del local: cliente, productos, qué está apartado y qué espera, seña y saldo.
- **Copia para el depósito**, para pegar en el producto reservado. Es **una sola hoja por reserva**, con todos los productos (decisión de Nahuel). Muestra bien grande RESERVADO, el número de reserva, el nombre de la clienta y la lista de productos con su cantidad y si están apartados o esperando.
También se pueden reimprimir desde el detalle. Cuando la reserva queda lista o cambia (seña, cancelación), el detalle ofrece reimprimir.

**Concretar.** Con la reserva `LISTA`, la vendedora la convierte en venta: se descuenta el stock apartado, se genera el ticket y el comprobante, y el saldo se cobra con el método de pago que elija. La seña ya cobrada se descuenta. El comprobante imprime la seña en el campo "SEÑA" del formulario y el saldo a pagar.

**Cancelar.** La vendedora elige si devuelve la seña (se registra una `DEVOLUCION` con su método de pago y la plata sale de caja) o si la retiene (queda como ingreso del negocio). El stock apartado queda disponible de nuevo, y eso también reparte lo liberado a otras reservas que esperaban.

**Vencimiento (si está activado).** Pasados N días desde que la reserva quedó lista sin concretarse, pasa a `VENCIDA` y libera lo apartado. Una reserva que todavía espera stock no vence. Con el interruptor apagado, las reservas duran hasta que alguien las cancele.

## Plata

- **Dashboard del admin:** las señas aparecen en su propia línea, "Señas cobradas", neta de devoluciones, para el período elegido. No se mezclan con "Total facturado".
- **Venta que concreta una reserva:** suma al facturado sólo el saldo cobrado ese día (total − seña), para no contar dos veces la seña ya cobrada.
- **Señas sin resolver:** lista visible de reservas cerradas con seña que todavía no se decidió devolver o retener.

## Pantallas

Pensadas para celular y tablet.

- **Menú:** "Reservas", con un número de las que están listas para avisar.
- **Lista de Reservas:** pestañas "Esperando", "Listas", "Cerradas". Cada tarjeta muestra clienta, productos, qué falta y cuánto dejó de seña.
- **Nueva reserva:** buscador de productos como en Nueva venta, que además deja agregar variantes sin stock, con cliente, dirección y seña opcionales.
- **Detalle:** estado de cada producto (apartado o esperando), pagos, y las acciones: registrar seña, avisar por WhatsApp, convertir en venta, cancelar.
- **Depósito:** columnas de stock, reservado y disponible.
- **Nueva venta y catálogo:** muestran y validan contra el stock disponible.
- **Panel del admin:** una sección de ajustes con el interruptor y los días de la liberación automática.

## Pendiente

- Edición de una reserva existente: fuera de la primera versión.
