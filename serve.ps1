<#
  Sehr einfacher lokaler Webserver zum Testen von docs/ im Browser.
  Ausfuehren mit: ./serve.ps1  (dann http://localhost:8080 im Browser oeffnen)
#>
param([int]$Port = 8080)

$root = Join-Path $PSScriptRoot "docs"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Server laeuft: http://localhost:$Port/  (Strg+C zum Beenden)" -ForegroundColor Green

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    $path = $req.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $root ($path.TrimStart("/"))

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath)
        $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $res.ContentType = $contentType
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 - nicht gefunden: $path")
        $res.OutputStream.Write($notFound, 0, $notFound.Length)
    }
    $res.OutputStream.Close()
}

