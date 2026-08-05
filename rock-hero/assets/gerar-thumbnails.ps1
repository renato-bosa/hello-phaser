param(
    [ValidateRange(100, 4000)]
    [int]$Size = 640,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$assetsDir = $PSScriptRoot
$outputDir = Join-Path $assetsDir '_map-previews'

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

# Procura o tmxrasterizer no PATH e nos locais comuns do Tiled.
$candidates = @()

$command = Get-Command 'tmxrasterizer.exe' -ErrorAction SilentlyContinue

if ($command) {
    $candidates += $command.Source
}

if ($env:ProgramFiles) {
    $candidates += Join-Path $env:ProgramFiles 'Tiled\tmxrasterizer.exe'
}

if (${env:ProgramFiles(x86)}) {
    $candidates += Join-Path ${env:ProgramFiles(x86)} 'Tiled\tmxrasterizer.exe'
}

$rasterizer = $candidates |
    Where-Object { $_ -and (Test-Path $_) } |
    Select-Object -First 1

if (-not $rasterizer) {
    throw @"
Não foi possível localizar o tmxrasterizer.exe.

Verifique se o Tiled está instalado. O caminho normalmente é:
C:\Program Files\Tiled\tmxrasterizer.exe
"@
}

Write-Host "Tiled Rasterizer: $rasterizer" -ForegroundColor Cyan
Write-Host "Pasta dos mapas: $assetsDir" -ForegroundColor Cyan
Write-Host ""

# Encontra arquivos map*.json e map*.tmj.
$maps = Get-ChildItem -Path $assetsDir -File |
    Where-Object {
        $_.BaseName -like 'map*' -and
        $_.Extension.ToLowerInvariant() -in @('.json', '.tmj')
    }

# Quando existem map-X.json e map-X.tmj, usa o arquivo mais recentemente alterado.
$maps = $maps |
    Group-Object BaseName |
    ForEach-Object {
        $_.Group |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
    } |
    Sort-Object BaseName

if (-not $maps) {
    throw "Nenhum mapa map*.json ou map*.tmj foi encontrado."
}

$galleryItems = @()

foreach ($map in $maps) {
    $previewName = "$($map.BaseName).png"
    $previewPath = Join-Path $outputDir $previewName

    $shouldGenerate =
        $Force -or
        -not (Test-Path $previewPath) -or
        ((Get-Item $previewPath).LastWriteTime -lt $map.LastWriteTime)

    if ($shouldGenerate) {
        Write-Host "Renderizando $($map.Name)..." -ForegroundColor Yellow

        & $rasterizer `
            --size $Size `
            $map.FullName `
            $previewPath

        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Falha ao renderizar $($map.Name)."
            continue
        }
    }
    else {
        Write-Host "Mantendo preview atualizado: $previewName" -ForegroundColor DarkGray
    }

    if (Test-Path $previewPath) {
        $galleryItems += [PSCustomObject]@{
            Name   = $map.BaseName
            Source = $map.Name
            Image  = $previewName
        }
    }
}

# Cria os cards da galeria.
$cards = foreach ($item in $galleryItems) {
    $title = [System.Net.WebUtility]::HtmlEncode($item.Name)
    $source = [System.Net.WebUtility]::HtmlEncode($item.Source)
    $image = [System.Uri]::EscapeDataString([string]$item.Image)

@"
<article class="card">
    <a href="$image" target="_blank">
        <img src="$image" alt="$title" loading="lazy">
    </a>

    <div class="info">
        <strong>$title</strong>
        <small>$source</small>
    </div>
</article>
"@
}

$generatedAt = Get-Date -Format 'dd/MM/yyyy HH:mm:ss'
$mapCount = $galleryItems.Count

$html = @"
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>Mapas do Rock Hero</title>

    <style>
        :root {
            color-scheme: dark;
            font-family: system-ui, sans-serif;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 32px;
            background: #111827;
            color: #f9fafb;
        }

        header {
            margin-bottom: 28px;
        }

        h1 {
            margin: 0 0 8px;
        }

        header p {
            margin: 0;
            color: #9ca3af;
        }

        .gallery {
            display: grid;
            grid-template-columns:
                repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
        }

        .card {
            overflow: hidden;
            border: 1px solid #374151;
            border-radius: 12px;
            background: #1f2937;
            box-shadow: 0 8px 20px rgb(0 0 0 / 20%);
        }

        .card a {
            display: flex;
            min-height: 220px;
            align-items: center;
            justify-content: center;
            padding: 12px;
            background:
                linear-gradient(45deg, #111827 25%, transparent 25%),
                linear-gradient(-45deg, #111827 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #111827 75%),
                linear-gradient(-45deg, transparent 75%, #111827 75%);
            background-position:
                0 0,
                0 8px,
                8px -8px,
                -8px 0;
            background-size: 16px 16px;
        }

        .card img {
            display: block;
            width: 100%;
            max-height: 420px;
            object-fit: contain;
            image-rendering: pixelated;
        }

        .info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 14px 16px;
        }

        .info strong {
            font-size: 16px;
        }

        .info small {
            color: #9ca3af;
        }
    </style>
</head>

<body>
    <header>
        <h1>Mapas do Rock Hero</h1>
        <p>
            $mapCount mapas — atualizado em $generatedAt
        </p>
    </header>

    <main class="gallery">
        $($cards -join "`n")
    </main>
</body>
</html>
"@

$indexPath = Join-Path $outputDir 'index.html'

Set-Content `
    -Path $indexPath `
    -Value $html `
    -Encoding UTF8

Write-Host ""
Write-Host "$mapCount previews disponíveis." -ForegroundColor Green
Write-Host "Galeria: $indexPath" -ForegroundColor Green

Start-Process $indexPath