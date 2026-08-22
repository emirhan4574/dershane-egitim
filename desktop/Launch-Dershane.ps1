# Dershane masaüstü başlatıcı — web yoksa açar, sonra Electron penceresini getirir.
$ErrorActionPreference = 'Stop'

$DesktopDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $DesktopDir
$AppUrl = if ($env:DERSHANE_APP_URL) { $env:DERSHANE_APP_URL } else { 'http://localhost:8081' }
$ElectronJs = Join-Path $DesktopDir 'node_modules\electron\cli.js'

function Test-AppUp {
  try {
    $r = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 2
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch {
    return $false
  }
}

if (-not (Test-Path $ElectronJs)) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    "Electron bulunamadı.`nÖnce proje içinde:`ncd desktop`nnpm install",
    'Dershane',
    'OK',
    'Error'
  ) | Out-Null
  exit 1
}

if (-not (Test-AppUp)) {
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', 'npm run web' `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Minimized

  $deadline = (Get-Date).AddMinutes(2)
  while (-not (Test-AppUp)) {
    if ((Get-Date) -gt $deadline) {
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.MessageBox]::Show(
        "Web sunucusu ($AppUrl) 2 dakika içinde açılmadı.`nTerminalde 'npm run web' çalıştırıp tekrar deneyin.",
        'Dershane',
        'OK',
        'Warning'
      ) | Out-Null
      exit 1
    }
    Start-Sleep -Seconds 2
  }
}

Set-Location $DesktopDir
& node $ElectronJs .
