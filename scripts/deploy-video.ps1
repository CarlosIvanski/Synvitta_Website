# Envia videos para a VPS via SCP (sem GitHub / Git LFS).
# Uso (PowerShell, na pasta do projeto):
#   .\scripts\deploy-video.ps1

param(
    [string]$ServerHost = "10.0.0.1",
    [string]$User = "admincarlos",
    [string]$RemotePath = "/opt/website/Synvitta_Website"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Videos = @(
    "Syntrep_Horizontal.mp4",
    "video_synvitta.mp4"
)

foreach ($name in $Videos) {
    $local = Join-Path $Root "video\$name"
    if (-not (Test-Path $local)) {
        Write-Error "Arquivo nao encontrado: $local"
    }
    $size = (Get-Item $local).Length
    if ($size -lt 500KB) {
        Write-Error "$name tem apenas $size bytes — parece ponteiro Git LFS."
    }
    Write-Host "Enviando $name ($([math]::Round($size / 1MB, 1)) MB) ..."
    scp $local "${User}@${ServerHost}:~/$name"
}

$copyCmd = ($Videos | ForEach-Object {
    "sudo cp ~/$($_) ${RemotePath}/video/$($_)"
}) -join " && "

Write-Host "Copiando na VPS e rebuild..."
ssh "${User}@${ServerHost}" "$copyCmd && ls -lh ${RemotePath}/video/*.mp4 && cd ${RemotePath} && docker compose build web && docker compose up -d web"

Write-Host "Concluido."
