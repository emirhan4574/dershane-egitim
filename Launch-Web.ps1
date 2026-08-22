# Dershane web sitesini başlatır (masaüstü Electron yok).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppUrl = 'http://localhost:8081'

function Test-Site {
  try {
    $r = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 2
    return $r.StatusCode -ge 200 -and $r.StatusCode -lt 500
  } catch {
    return $false
  }
}

Set-Location $Root

if (-not (Test-Site)) {
  Write-Host "Web baslatiliyor (npm run web)..."
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run web' -WorkingDirectory $Root -WindowStyle Minimized
  $deadline = (Get-Date).AddMinutes(2)
  while (-not (Test-Site)) {
    if ((Get-Date) -gt $deadline) {
      Write-Host "Site 2 dk icinde acilmadi. Terminalde 'npm run web' calistirin."
      exit 1
    }
    Start-Sleep -Seconds 2
  }
}

Start-Process $AppUrl
