param([string]$Out)
Add-Type -AssemblyName System.Drawing
$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded jade tile
$r = 110
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $r, $r, 180, 90)
$path.AddArc($size - $r, 0, $r, $r, 270, 90)
$path.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
$path.AddArc(0, $size - $r, $r, $r, 90, 90)
$path.CloseFigure()
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 21, 116, 90))
$g.FillPath($brush, $path)

# The character 学 in white
$font = $null
foreach ($name in @("Microsoft YaHei UI", "Microsoft YaHei", "SimHei", "SimSun")) {
  try { $font = New-Object System.Drawing.Font($name, 300, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); if ($font.Name -eq $name) { break } } catch {}
}
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$white = [System.Drawing.Brushes]::White
$rect = New-Object System.Drawing.RectangleF 0, 10, $size, $size
$g.DrawString([string][char]0x5B66, $font, $white, $rect, $fmt)

$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("icon saved: " + $Out + " font=" + $font.Name)
