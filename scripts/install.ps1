# IDM CLI installer (Windows) — downloads the standalone binary from GitHub
# releases, verifies its checksum, installs to %LOCALAPPDATA%\Programs\idm,
# adds it to the user PATH, and installs the idm-cli agent skill.
#
#   irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex
#
# Options (env vars): IDM_VERSION (tag, default latest), IDM_INSTALL_DIR,
#   IDM_SKILL = claude | codex | both | skip | auto (default: ask when interactive)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

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
    try {
        Invoke-WebRequest -Uri "$Base/$Asset" -OutFile (Join-Path $Tmp $Asset)
        Invoke-WebRequest -Uri "$Base/checksums.txt" -OutFile (Join-Path $Tmp 'checksums.txt')
    } catch {
        Write-Error ("Download failed from $Base/$Asset — has a release been published yet? " +
            "Check https://github.com/$Repo/releases  ($($_.Exception.Message))")
    }

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

    $skillChoice = $env:IDM_SKILL
    if (-not $skillChoice) {
        if ([Environment]::UserInteractive) {
            Write-Host ''
            Write-Host 'Install the idm-cli agent skill? (multiple allowed, e.g. 1,3)'
            Write-Host '  1) Claude Code    (~\.claude\skills)'
            Write-Host '  2) OpenAI Codex   (~\.codex\skills)'
            Write-Host '  3) Cursor         (~\.cursor\skills + project .cursor\skills)'
            Write-Host '  4) Antigravity    (IDE ~\.agents\skills + CLI ~\.gemini\antigravity-cli\skills)'
            Write-Host '  5) Claude Cowork  (packages idm-cli-skill.zip to upload in the app)'
            Write-Host '  6) All of the above'
            Write-Host '  7) Skip'
            try { $skillChoice = Read-Host 'Choice [1]' } catch { $skillChoice = '' }
            if (-not $skillChoice) { $skillChoice = '1' }
        } else {
            $skillChoice = 'auto'
        }
    }

    $choice = $skillChoice.ToLower()
    if ($choice -match '(^|,)\s*7\s*(,|$)' -or $choice -match 'skip') {
        Write-Host 'Skipped skill install (rerun anytime with: idm skill install)'
    } elseif ($choice -eq 'auto') {
        & $exe skill install
    } else {
        $skillArgs = @()
        if ($choice -match '(^|,)\s*1\s*(,|$)' -or $choice -match 'claude')      { $skillArgs += '--claude' }
        if ($choice -match '(^|,)\s*2\s*(,|$)' -or $choice -match 'codex')       { $skillArgs += '--codex' }
        if ($choice -match '(^|,)\s*3\s*(,|$)' -or $choice -match 'cursor')      { $skillArgs += '--cursor' }
        if ($choice -match '(^|,)\s*4\s*(,|$)' -or $choice -match 'antigravity') { $skillArgs += '--antigravity' }
        if ($choice -match '(^|,)\s*5\s*(,|$)' -or $choice -match 'cowork')      { $skillArgs += '--cowork' }
        if ($choice -match '(^|,)\s*6\s*(,|$)' -or $choice -match 'all')         { $skillArgs = @('--claude','--codex','--cursor','--antigravity','--cowork') }
        if ($choice -match 'both') { $skillArgs = @('--claude','--codex') }
        if ($skillArgs.Count -eq 0) { $skillArgs = @('--claude') }
        & $exe skill install @skillArgs
    }

    Write-Host ''
    Write-Host 'Next steps:'
    Write-Host '  idm init scene.json        # starter scene'
    Write-Host '  idm compile scene.json     # compile locally'
    Write-Host '  idm auth login             # add Idomoo credentials to render MP4s'
}
finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
