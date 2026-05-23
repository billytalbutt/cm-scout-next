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

function Save-CoverPng(
  [System.Drawing.Image]$src,
  [string]$outPath,
  [int]$boxW,
  [int]$boxH,
  [double]$zoom
) {
  $bmp = New-Object System.Drawing.Bitmap $boxW, $boxH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.Clear([System.Drawing.Color]::Transparent)

  $scale = [Math]::Max($boxW / $src.Width, $boxH / $src.Height) * $zoom
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

  $publicDir = Join-Path $root 'src\renderer\public'
  $buildDir = Join-Path $root 'build'
  New-Item -ItemType Directory -Force -Path $publicDir, $buildDir | Out-Null

  $zoom = 1.08
  foreach ($size in @(32, 48, 64, 128, 256)) {
    $out = Join-Path $publicDir "favicon-$size.png"
    Save-CoverPng $srcFile $out $size $size $zoom
  }
  $faviconPath = Join-Path $publicDir 'favicon.png'
  Save-CoverPng $srcFile $faviconPath 256 256 $zoom
  Copy-Item $faviconPath (Join-Path $publicDir 'favicon-256.png') -Force

  $assetsDir = Join-Path $root 'src\renderer\src\assets'
  $loadFaviconAsset = Join-Path $assetsDir 'merlin-favicon.png'
  Copy-Item $faviconPath $loadFaviconAsset -Force

  $installerIcon = Join-Path $buildDir 'icon.png'
  Save-CoverPng $srcFile $installerIcon 1024 1024 1.05
  Save-HeightPng $srcFile (Join-Path $assetsDir 'load-screen-mascot.png') 360

  Write-Host "Wrote favicon.png + favicon-{32,48,64,128,256}.png (cover fill)"
  Write-Host "Wrote merlin-favicon.png (same as favicon — load overlay)"
  Write-Host "Wrote load-screen-mascot.png (360px tall, transparent)"
  Write-Host "Wrote $installerIcon"
} finally {
  $srcFile.Dispose()
}
