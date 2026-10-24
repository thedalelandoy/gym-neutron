# Re-saves docs/screenshots/*.png as JPEG (quality 82), max 1280 px wide,
# so the report screenshots stay small enough for the submission ZIP.
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot "..\docs\screenshots"
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]82)

Get-ChildItem $dir -Filter *.png | ForEach-Object {
  $src = [System.Drawing.Image]::FromFile($_.FullName)
  $scale = [Math]::Min(1, 1280 / $src.Width)
  $w = [int]($src.Width * $scale)
  $h = [int]($src.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $w, $h)
  $out = [System.IO.Path]::ChangeExtension($_.FullName, ".jpg")
  $bmp.Save($out, $codec, $params)
  $g.Dispose(); $bmp.Dispose(); $src.Dispose()
  Remove-Item $_.FullName
}
Get-ChildItem $dir | Select-Object Name, @{ n = "KB"; e = { [math]::Round($_.Length / 1KB) } }
