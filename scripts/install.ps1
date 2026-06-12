# IDM CLI installer (Windows PowerShell): npm-installs the CLI from this repo
# and installs the idm-maker agent skill into ~\.claude\skills.
#
#   irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$Repo = if ($env:IDM_CLI_REPO) { $env:IDM_CLI_REPO } else { 'https://github.com/Idomoo-RnD/vasco.git' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js >= 18 is required (https://nodejs.org)'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error 'npm is required (ships with Node.js)'
}
$nodeMajor = [int](node -p 'process.versions.node.split(".")[0]')
if ($nodeMajor -lt 18) {
    Write-Error "Node.js >= 18 required, found $(node -v)"
}

Write-Host "Installing idm CLI from $Repo ..."
npm install -g "git+$Repo"
if ($LASTEXITCODE -ne 0) { Write-Error 'npm install failed' }

Write-Host 'Installing the idm-maker agent skill into ~\.claude\skills ...'
idm skill install

Write-Host ''
Write-Host "✅ idm $(idm version) installed."
Write-Host 'Next steps:'
Write-Host '  idm init scene.json        # starter scene'
Write-Host '  idm compile scene.json     # compile locally'
Write-Host '  idm auth login             # add Idomoo credentials to render MP4s'
