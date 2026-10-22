# Instala la estacion de impresion del local en esta PC (Windows + Google Chrome).
# Crea un acceso directo en el Escritorio y en el Inicio de Windows que abre /impresion
# con impresion silenciosa (sin cuadro "Imprimir").
# Uso: doble clic en instalar-estacion.bat, o:
#   powershell -ExecutionPolicy Bypass -File instalar-estacion.ps1 -Sitio https://mi-sitio.netlify.app -Clave LA_CLAVE
# -SinCrear solo muestra lo que haria, sin crear nada.
param(
  [string]$Sitio,
  [string]$Clave,
  [switch]$SinCrear
)
$ErrorActionPreference = 'Stop'

if (-not $Sitio) { $Sitio = Read-Host 'Direccion del sitio (ej: https://mi-sitio.netlify.app)' }
if (-not $Clave) { $Clave = Read-Host 'Clave de la estacion (PRINT_STATION_KEY)' }
$Sitio = $Sitio.Trim().TrimEnd('/')
$Clave = $Clave.Trim()
if (-not $Sitio) { throw 'Falta la direccion del sitio.' }
if (-not $Clave) { throw 'Falta la clave.' }
if ($Sitio -notmatch '^https?://') { $Sitio = "https://$Sitio" }

$candidatos = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'No encontre Google Chrome en esta PC. Instalalo y volve a correr este script.' }

# Perfil propio: si ya hay un Chrome abierto, sin esto Chrome ignora --kiosk-printing.
$perfil = 'C:\estacion-impresion'
$url = "$Sitio/impresion?clave=$([uri]::EscapeDataString($Clave))"
$argumentos = "--kiosk-printing --user-data-dir=`"$perfil`" --app=`"$url`""

try {
  $predeterminada = Get-CimInstance Win32_Printer -ErrorAction Stop | Where-Object { $_.Default } | Select-Object -First 1
  if ($predeterminada) {
    Write-Host "Impresora predeterminada: $($predeterminada.Name)"
    if ($predeterminada.Name -match 'PDF|OneNote|XPS|Fax') {
      Write-Warning 'La impresora predeterminada NO parece una impresora fisica. Cambiala a la A4 del local, si no va a pedir donde guardar un archivo.'
    }
  } else {
    Write-Warning 'No hay impresora predeterminada. Configura la A4 del local como predeterminada en Windows.'
  }
} catch {
  Write-Warning 'No pude comprobar la impresora predeterminada. Verifica a mano que la A4 del local este como predeterminada.'
}

if ($SinCrear) {
  Write-Host "Chrome: $chrome"
  Write-Host "Argumentos: --kiosk-printing --user-data-dir=`"$perfil`" --app=`"$Sitio/impresion?clave=****`""
  Write-Host 'Modo -SinCrear: no se creo ningun acceso directo.'
  return
}

$shell = New-Object -ComObject WScript.Shell
$carpetas = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('Startup')
)
foreach ($carpeta in $carpetas) {
  $acceso = $shell.CreateShortcut((Join-Path $carpeta 'Estacion de impresion.lnk'))
  $acceso.TargetPath = $chrome
  $acceso.Arguments = $argumentos
  $acceso.WorkingDirectory = Split-Path $chrome
  $acceso.Description = 'Imprime automaticamente las ventas y presupuestos'
  $acceso.Save()
  Write-Host "Acceso directo creado en: $carpeta"
}

Write-Host ''
Write-Host 'Listo. Cerra cualquier ventana de la estacion y abri "Estacion de impresion" desde el Escritorio.'
Write-Host 'A partir de ahora tambien se abre sola al iniciar Windows. Dejala abierta durante el horario de atencion.'
