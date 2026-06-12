# IDM CLI installer (Windows) — downloads the standalone binary from GitHub
# releases, verifies its checksum, installs to %LOCALAPPDATA%\Programs\idm,
# adds it to the user PATH, and installs the idm-maker agent skill.
#
#   irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex
#
# Options (env vars): IDM_VERSION (tag, default latest), IDM_INSTALL_DIR

$ErrorActionPreference = 'Stop'

$Repo = 'Idomoo-RnD/vasco'
$Version = if ($env:IDM_VERSION) { $env:IDM_VERSION } else { 'latest' }
$InstallDir = if ($env:IDM_INSTALL_DIR) { $env:IDM_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\idm' }
$Asset = 'idm_windows_amd64.exe'

$Base = if ($Version -eq 'latest') {
    "https://github.com/$Repo/releases/latest/download"
} else {
    "https://github.com/$Repo/releases/download/$Version"
}

$Tmp = Join-Path $env:TEMP ("idm-install-" + [guid]::NewGuid().ToString('n').Substring(0, 8))
New-Item -ItemType Directory -Force $Tmp | Out-Null

try {
    Write-Host "Downloading $Asset ($Version) ..."
    Invoke-WebRequest -Uri "$Base/$Asset" -OutFile (Join-Path $Tmp $Asset)
    Invoke-WebRequest -Uri "$Base/checksums.txt" -OutFile (Join-Path $Tmp 'checksums.txt')

    $expected = (Select-String -Path (Join-Path $Tmp 'checksums.txt') -Pattern ([regex]::Escape($Asset))).Line.Split(' ')[0]
    $actual = (Get-FileHash -Algorithm SHA256 (Join-Path $Tmp $Asset)).Hash.ToLower()
    if ($expected -ne $actual) { Write-Error "checksum verification failed (expected $expected, got $actual)" }
    Write-Host 'Checksum OK.'

    New-Item -ItemType Directory -Force $InstallDir | Out-Null
    $exe = Join-Path $InstallDir 'idm.exe'
    if (Test-Path $exe) { Move-Item -Force $exe "$exe.old"; Remove-Item "$exe.old" -ErrorAction SilentlyContinue }
    Move-Item -Force (Join-Path $Tmp $Asset) $exe

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($userPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
        $env:Path = "$env:Path;$InstallDir"
        Write-Host "Added $InstallDir to your user PATH (restart shells to pick it up)."
    }

    Write-Host "Installed $exe ($(& $exe version))"
    & $exe skill install

    Write-Host ''
    Write-Host 'Next steps:'
    Write-Host '  idm init scene.json        # starter scene'
    Write-Host '  idm compile scene.json     # compile locally'
    Write-Host '  idm auth login             # add Idomoo credentials to render MP4s'
}
finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
