# Importación masiva de productos con Gemini

## Objetivo

El cliente tiene su inventario (productos, precios, stock) en una planilla. Hay que
cargarlo en el sistema sin tipear producto por producto. El administrador sube un
archivo, revisa lo que se interpretó y confirma. Las fotos se cargan después, de a
una, desde cada producto (fuera de alcance).

## Formatos soportados

| Formato | Cómo se procesa |
|---|---|
| CSV, XLSX | Se leen localmente en el servidor (exacto). El texto de las filas se manda a Gemini para interpretar columnas y normalizar. |
| PDF | Se manda a Gemini como archivo (lectura nativa). |
| Imagen (JPG/PNG/WebP) | Igual que PDF. Mismo camino, sin costo extra de diseño. |

Todos los caminos terminan en el mismo formato de datos y en la misma pantalla de revisión.

## Flujo

1. **Subir:** pantalla `/productos/importar` (solo ADMIN, link desde `/productos`).
2. **Interpretar:** el servidor extrae las filas (CSV/XLSX) o pasa el archivo a Gemini (PDF/imagen). Gemini devuelve JSON con el esquema de abajo.
3. **Revisar:** tabla editable con lo que se va a crear. Cada fila muestra su estado: nueva, ya existe (se saltea), con error. Las categorías nuevas se marcan. Nada se guarda todavía.
4. **Confirmar:** una sola transacción crea categorías faltantes, productos, variantes y stock inicial. Si algo falla no se guarda nada.

## Contrato de datos (cada fila interpretada)

```
categoria: string
producto: string
variante: string        // si no hay variantes, "Único"
medida?, tela?, color?: string
costo?: number >= 0
precio?: number >= 0
stock: entero >= 0      // vacío = 0
```

Se valida con zod en el servidor. El producto se agrupa por (categoría, nombre); varias filas con el mismo producto son variantes de él.

## Uso de Gemini

- SDK `@google/genai`, solo en el servidor. Clave en `GEMINI_API_KEY`; modelo en `GEMINI_MODEL` (por defecto un modelo "flash", barato y rápido; verificar el nombre vigente al implementar).
- Salida estructurada (JSON con `responseSchema`), nunca texto libre.
- El contenido del archivo es dato, no instrucciones: el prompt lo aclara y la salida se valida igual con zod.
- No se registra el contenido de los archivos en logs.

## Reglas al guardar

- Producto existente (misma categoría y nombre): se saltea y se marca en la revisión. No se pisan precios ni stock existentes.
- Variante existente dentro de un producto: se saltea.
- Categoría inexistente: se crea (slug generado igual que en el alta manual de categorías).
- Stock inicial: `InventoryStock.quantity` + `InventoryTransaction` tipo `CARGA_INICIAL` por cada variante con stock > 0, con el mismo `batchId`.
- Precio/costo vacío: se permite (el sistema ya maneja `null`), pero se marca como aviso porque esa variante no se podrá vender hasta tener precio.

## Límites y despliegue (Netlify)

- Las funciones de Netlify tienen un límite de cuerpo de ~6 MB y un tiempo de ejecución corto. Por eso:
  - Archivos de hasta 4 MB.
  - CSV/XLSX se procesan en lotes de ~40 filas, un request por lote desde el cliente, con barra de progreso.
  - PDF/imagen: se procesa de a un archivo; si es muy largo, se pide dividirlo (se muestra el error con ese consejo).
- El upload usa un Route Handler (no la Server Action, que está limitada a 6 MB global en `next.config.ts`).

## Errores

- Gemini falla o devuelve algo que no valida: mensaje claro, se puede reintentar; no se pierde el archivo subido en pantalla.
- Archivo ilegible o vacío: error indicando el formato aceptado.
- Filas inválidas: quedan marcadas en la revisión y se pueden corregir o descartar; las demás se pueden confirmar igual.

## Seguridad

- Solo rol ADMIN (`requireRole('ADMIN')`) en el Route Handler y en la acción de confirmar.
- Tipo y tamaño de archivo validados en el servidor.
- La clave de Gemini nunca llega al navegador.

## Pruebas

- Unitarias: parseo de CSV/XLSX, validación zod del contrato, agrupación producto/variante.
- Integración (con base de test): confirmar crea categorías, productos, variantes, stock y movimientos `CARGA_INICIAL`; productos repetidos se saltean; fallo a mitad no deja datos.
- Gemini siempre mockeado en tests.

## Fuera de alcance

- Subir fotos en la importación.
- Actualizar precios o stock de productos existentes.
- Importación recurrente o programada.
