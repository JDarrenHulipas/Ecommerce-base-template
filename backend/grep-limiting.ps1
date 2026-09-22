$files = @(
 "C:\Users\Usuario\Documents\Default Project\bakerycloud\backend\src\app.js",
 "C:\Users\Usuario\Documents\Default Project\bakerycloud\backend\src\routes\admin.js",
 "C:\Users\Usuario\Documents\Default Project\bakerycloud\backend\src\config\env.js"
)
foreach ($f in $files) {
  "==== $f ===="
  $n=0
  Get-Content $f | ForEach-Object { $n++; if ($_ -match "express\.json|bodyParser|raw|limit|json\(\{|imagen|imagen_s3|base64|data:|contentType|multipart|multer|abort|timeout|server\.timeout|maxBody") { "{0}: {1}" -f $n, $_.Trim() } }
}
