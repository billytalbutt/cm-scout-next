# Brand mascot (load screen + favicon). Header uses soccer-wizard-mascot.png — do not overwrite.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root 'src\renderer\src\assets\wizard-brand-mascot.png'
if (-not (Test-Path $srcPath)) {
  throw "Missing $srcPath - add wizard-brand-mascot.png (wide mascot with black background)."
}

Add-Type -AssemblyName System.Drawing

function Remove-NearBlackBackground([System.Drawing.Bitmap]$bmp, [int]$threshold = 42) {
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -gt 0 -and $c.R -le $threshold -and $c.G -le $threshold -and $c.B -le $threshold) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      }
    }
  }
}

function New-CutoutBitmap([System.Drawing.Image]$src) {
  $cut = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($cut)
  $g.DrawImage($src, 0, 0, $src.Width, $src.Height)
  $g.Dispose()
  Remove-NearBlackBackground $cut
  return $cut
}

function Save-CircularIcon(
  [System.Drawing.Image]$src,
  [string]$outPath,
  [int]$size,
  [System.Drawing.Color]$backdrop
) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear($backdrop)

  $inset = [Math]::Max(2, [int]($size * 0.04))
  $diameter = $size - $inset * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($inset, $inset, $diameter, $diameter)
  $g.SetClip($path)

  $scale = [Math]::Min($diameter / $src.Width, $diameter / $src.Height) * 0.9
  $newW = [int]($src.Width * $scale)
  $newH = [int]($src.Height * $scale)
  $x = $inset + [int](($diameter - $newW) / 2)
  $y = $inset + [int](($diameter - $newH) / 2)
  $g.DrawImage($src, $x, $y, $newW, $newH)
  $g.Dispose()
  $path.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Save-LoadScreenMascot([System.Drawing.Image]$src, [string]$outPath, [int]$maxHeight) {
  $zinc900 = [System.Drawing.Color]::FromArgb(255, 24, 24, 27)
  $scale = $maxHeight / $src.Height
  $w = [int]($src.Width * $scale)
  $h = $maxHeight
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($zinc900)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$srcFile = [System.Drawing.Image]::FromFile($srcPath)
try {
  $cutout = New-CutoutBitmap $srcFile

  $faviconPath = Join-Path $root 'src\renderer\public\favicon.png'
  $loadPath = Join-Path $root 'src\renderer\src\assets\load-screen-mascot.png'
  $buildDir = Join-Path $root 'build'
  $installerIcon = Join-Path $buildDir 'icon.png'
  New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

  $transparent = [System.Drawing.Color]::Transparent
  Save-CircularIcon $cutout $faviconPath 32 $transparent
  Save-CircularIcon $cutout $installerIcon 1024 $transparent
  Save-LoadScreenMascot $cutout $loadPath 320

  Write-Host "Wrote $faviconPath (circular, transparent)"
  Write-Host "Wrote $loadPath (zinc-900 backdrop, 320px tall)"
  Write-Host "Wrote $installerIcon (circular, transparent)"
} finally {
  $cutout.Dispose()
  $srcFile.Dispose()
}
