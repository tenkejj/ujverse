Add-Type -AssemblyName System.Drawing

$src = "C:\Users\frani\ujverse\public\logo.png"
$dst = "C:\Users\frani\ujverse\public\favicon.png"

$img = [System.Drawing.Image]::FromFile($src)
Write-Output ("source: " + $img.Width + "x" + $img.Height)

# Kadrujemy KWADRAT obejmujacy SAMA ikone (czapka + U + wieniec),
# bez napisu "ujverse" pod spodem.
# Ikona w pliku 728x1372 zajmuje mniej wiecej y=350..920, wycentrowana poziomo.
$iconTop = [int]($img.Height * 0.22)   # ~302
$iconBottom = [int]($img.Height * 0.605) # ~830
$iconH = $iconBottom - $iconTop
$iconW = $iconH
$cropX = [int](($img.Width - $iconW) / 2)
$cropY = $iconTop

if ($cropX -lt 0) {
    $pad = [int](($iconW - $img.Width) / 2)
    $cropX = 0
    $iconW = $img.Width
}

$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $iconW, $iconH)

# Skalujemy do 256x256 (ostre na ekranach hi-dpi).
$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$dstRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$img.Dispose()

Write-Output ("wrote: " + $dst)
