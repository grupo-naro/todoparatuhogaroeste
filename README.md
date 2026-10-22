This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Estación de impresión del local

**Atajo:** en la PC del local, ejecutar `scripts/estacion-impresion/instalar-estacion.bat` (pide la dirección del sitio y la clave) y crea los accesos directos del Escritorio e Inicio de Windows con todo lo de abajo ya configurado. Los pasos manuales siguen siendo:

Cada venta confirmada y cada presupuesto generado se imprimen solos en la impresora A4 del local, sin importar desde qué celular o tablet se hayan cargado. Para eso una computadora del local deja abierta la pantalla `/impresion`.

1. Dejar la impresora A4 como **predeterminada** en Windows.
2. Definir `PRINT_STATION_KEY` (una clave larga y aleatoria) en `.env` y en las variables de entorno de Netlify.
3. Crear un acceso directo a Chrome con este destino (reemplazar el sitio y la clave):

   ```
   "C:Program FilesGoogleChromeApplicationchrome.exe" --kiosk-printing --user-data-dir="C:estacion-impresion" --app="https://SITIO/impresion?clave=PRINT_STATION_KEY"
   ```

   - `--kiosk-printing` hace que `window.print()` mande directo a la impresora predeterminada, sin cuadro de diálogo.
   - `--user-data-dir` abre la estación con su propio perfil. Es necesario: si ya hay un Chrome abierto, el modo silencioso se ignora y aparece el cuadro "Imprimir".
   - La impresora predeterminada debe ser la A4 física (no "Microsoft Print to PDF").
4. Abrir ese acceso directo al encender la PC y no cerrarlo durante el horario de atención.

Notas:

- Debe haber **una sola** estación abierta; con dos, el mismo comprobante saldría dos veces.
- Si la PC está apagada o sin internet, los trabajos esperan y salen al volver, pero solo los de las últimas 12 horas.
- Los trabajos y los presupuestos guardados se borran solos a los 7 días.
- Los celulares y tablets conservan el botón "Imprimir" manual en cada comprobante.
- Las migraciones de la base real se aplican con `pnpm db:deploy`; las de la base de test con `pnpm test:db:migrate`.
