# Build favicon + installer icon from cm-merlin-cutout.png (Adobe transparent PNG).
# Header logo stays soccer-wizard-mascot.png — do not overwrite.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root 'src\renderer\src\assets\cm-merlin-cutout.png'
$downloadsCutout = Join-Path $env:USERPROFILE 'Downloads\CM Merlin Icon Favicon.png'
if (-not (Test-Path $srcPath) -and (Test-Path $downloadsCutout)) {
  Copy-Item $downloadsCutout $srcPath -Force
  Write-Host "Copied Adobe cutout from Downloads."
}
if (-not (Test-Path $srcPath)) {
  throw "Missing $srcPath - copy CM Merlin Icon Favicon.png from Downloads into that path."
}

Add-Type -AssemblyName System.Drawing

function Save-FittedPng(
  [System.Drawing.Image]$src,
  [string]$outPath,
  [int]$boxW,
  [int]$boxH,
  [System.Drawing.Color]$backdrop
) {
  $bmp = New-Object System.Drawing.Bitmap $boxW, $boxH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.Clear($backdrop)

  $scale = [Math]::Min($boxW / $src.Width, $boxH / $src.Height) * 0.92
  $newW = [int]($src.Width * $scale)
  $newH = [int]($src.Height * $scale)
  $x = [int](($boxW - $newW) / 2)
  $y = [int](($boxH - $newH) / 2)
  $g.DrawImage($src, $x, $y, $newW, $newH)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Save-HeightPng(
  [System.Drawing.Image]$src,
  [string]$outPath,
  [int]$maxHeight
) {
  $scale = $maxHeight / $src.Height
  $w = [Math]::Max(1, [int]($src.Width * $scale))
  $h = $maxHeight
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$srcFile = [System.Drawing.Image]::FromFile($srcPath)
try {
  if ($srcFile.Height -gt 900) {
    $tmp = Join-Path $env:TEMP 'cm-merlin-cutout-resized.png'
    Save-HeightPng $srcFile $tmp 720
    $srcFile.Dispose()
    $srcFile = [System.Drawing.Image]::FromFile($tmp)
    Copy-Item $tmp $srcPath -Force
    Write-Host "Downscaled master cutout to 720px height in assets."
  }

  $transparent = [System.Drawing.Color]::Transparent
  $faviconPath = Join-Path $root 'src\renderer\public\favicon.png'
  $buildDir = Join-Path $root 'build'
  $installerIcon = Join-Path $buildDir 'icon.png'
  New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

  Save-FittedPng $srcFile $faviconPath 32 32 $transparent
  Save-FittedPng $srcFile $installerIcon 1024 1024 $transparent
  Save-HeightPng $srcFile (Join-Path $root 'src\renderer\src\assets\load-screen-mascot.png') 360

  Write-Host "Wrote $faviconPath (32px, transparent)"
  Write-Host "Wrote load-screen-mascot.png (360px tall, transparent)"
  Write-Host "Wrote $installerIcon (1024px, transparent)"
} finally {
  $srcFile.Dispose()
}
