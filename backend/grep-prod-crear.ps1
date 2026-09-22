$f = "C:\Users\Usuario\Documents\Default Project\bakerycloud\frontend\admin\admin.js"
$ln = Get-Content $f
for ($i=0; $i -lt $ln.Count; $i++) {
  if ($ln[$i] -match "image/imagen|imagen_s3|imagen_s3|dataUrl|data:image|toBlob|multipart|FormData|createObjectURL|canvas|compres|fetch\(|/api/admin/imagenes|autoredimension|maxWidth|calidad") {
    "{0}: {1}" -f ($i+1), $ln[$i].Trim()
  }
}
