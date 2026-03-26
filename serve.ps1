$port = 4567
$root = "C:\Users\ecn\Code\aim-trainer"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

# Immediate stdout so preview_start detects readiness
[Console]::Out.WriteLine("Listening on port $port")
[Console]::Out.WriteLine("Serving on http://localhost:$port")
[Console]::Out.Flush()

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $urlPath = $ctx.Request.Url.LocalPath
    if ($urlPath -eq '/') { $urlPath = '/index.html' }
    $filePath = Join-Path $root ($urlPath.TrimStart('/').Replace('/', '\'))

    try {
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath)
            $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $ctx.Response.ContentType = $ct
            $ctx.Response.StatusCode = 200
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found: $urlPath")
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch {
        [Console]::Error.WriteLine("Error: $_")
    } finally {
        $ctx.Response.Close()
    }
}
