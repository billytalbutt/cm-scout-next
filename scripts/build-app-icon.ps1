# Regenerate build/icon.png (1024², installer/desktop) and src/renderer/public/favicon.png (32²)
# from src/renderer/src/assets/soccer-wizard-mascot.png after updating the mascot art.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root 'src\renderer\src\assets\soccer-wizard-mascot.png'
$buildDir = Join-Path $root 'build'
$iconPath = Join-Path $buildDir 'icon.png'
$faviconPath = Join-Path $root 'src\renderer\public\favicon.png'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($srcPath)
foreach ($spec in @(@{ Out = $iconPath; Size = 1024 }, @{ Out = $faviconPath; Size = 32 })) {
  $size = $spec.Size
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale = [Math]::Min($size / $src.Width, $size / $src.Height) * 0.92
  $newW = [int]($src.Width * $scale)
  $newH = [int]($src.Height * $scale)
  $x = [int](($size - $newW) / 2)
  $y = [int](($size - $newH) / 2)
  $g.DrawImage($src, $x, $y, $newW, $newH)
  $bmp.Save($spec.Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
$src.Dispose()
Write-Host "Wrote $iconPath and $faviconPath"
