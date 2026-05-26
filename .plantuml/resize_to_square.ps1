$src = 'd:\GITHUB\Dormitory_Graduation\DATN_WRITE\diagrams\usecase_registration.png'
$dst = 'd:\GITHUB\Dormitory_Graduation\DATN_WRITE\diagrams\usecase_registration_square.png'
$size = 600
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($src)
$thumb = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($thumb)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ratio = [Math]::Min($size / $img.Width, $size / $img.Height)
$newW = [int]($img.Width * $ratio)
$newH = [int]($img.Height * $ratio)
$offsetX = [int](($size - $newW) / 2)
$offsetY = [int](($size - $newH) / 2)
$g.DrawImage($img, $offsetX, $offsetY, $newW, $newH)
$img.Dispose()
$g.Dispose()
$thumb.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$thumb.Dispose()
Write-Output "Saved $dst"
