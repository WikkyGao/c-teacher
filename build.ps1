param(
    [string]$Bundle = "nsis"
)

$ErrorActionPreference = "Stop"

# Add cargo and VS Installer to PATH before running vcvars
$env:PATH = "C:\Users\22245\.cargo\bin;C:\Program Files (x86)\Microsoft Visual Studio\Installer;" + $env:PATH

# Run vcvars64.bat and capture output
Write-Output "Setting up VS environment..."
$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$envOutput = cmd.exe /c "set PATH=C:\Program Files (x86)\Microsoft Visual Studio\Installer;%PATH% && call `"$vcvars`" && set" 2>&1

# Apply environment variables from vcvars output
foreach ($line in $envOutput) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)') {
        $name = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

# Add NSIS to PATH AFTER vcvars (which may have overwritten PATH)
$env:PATH = "C:\Program Files (x86)\NSIS;" + $env:PATH

Write-Output "VCINSTALLDIR = $env:VCINSTALLDIR"
Write-Output "WindowsSdkDir = $env:WindowsSdkDir"
Write-Output "Cargo available: $(Get-Command cargo -ErrorAction SilentlyContinue)"

# MSVC target is already set via rustup directory override for D:\cteacher
$env:CARGO_TARGET_DIR = "D:\cteacher\apps\desktop\src-tauri\target"

# Build
Set-Location D:\cteacher
Write-Output "Starting Tauri build..."
& D:\cteacher\node_modules\.bin\tauri.ps1 build --bundles nsis
$exitCode = $LASTEXITCODE
Write-Output "Build completed with exit code: $exitCode"
exit $exitCode
