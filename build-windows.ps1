param(
  [ValidateSet("nsis", "msi")]
  [string]$Bundle = "nsis"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundleDir = Join-Path $RootDir "apps\desktop\src-tauri\target\release\bundle"

Set-Location $RootDir

function Require-Command($Name, $Message) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Error $Message
    exit 1
  }
}

Require-Command "npm" "npm is required to build the Windows installer."
Require-Command "cargo" "Rust/Cargo is required for Tauri packaging."

if (-not (Test-Path (Join-Path $RootDir "node_modules"))) {
  Write-Host "Installing npm dependencies..."
  npm install
}

Write-Host "Building C-teacher Windows installer ($Bundle)..."
npm run tauri --workspace "@c-teacher/desktop" -- build --bundles $Bundle

$Extension = if ($Bundle -eq "msi") { "*.msi" } else { "*.exe" }
$Installers = Get-ChildItem -Path $BundleDir -Recurse -Filter $Extension | Sort-Object LastWriteTime -Descending

if ($Installers.Count -eq 0) {
  Write-Error "No Windows installer was created under $BundleDir."
  exit 1
}

Write-Host "Windows installer ready:"
$Installers[0].FullName
