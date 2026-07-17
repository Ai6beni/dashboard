<#
  Baut aus content/*.md statische HTML-Seiten in docs/.
  Einfach ausfuehren mit: ./build.ps1
  Neues Thema hinzufuegen = neue .md-Datei in content/ anlegen, dann build.ps1 erneut ausfuehren.
#>

$ErrorActionPreference = "Stop"
$root      = $PSScriptRoot
$contentDir = Join-Path $root "content"
$outDir     = Join-Path $root "docs"
$assetsDir  = Join-Path $outDir "assets"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

function Format-Inline($text) {
    $t = $text
    $t = $t -replace '&', '&amp;'
    $t = $t -replace '<', '&lt;'
    $t = $t -replace '>', '&gt;'
    $t = [regex]::Replace($t, '`([^`]+)`', '<code>$1</code>')
    $t = [regex]::Replace($t, '\*\*(.+?)\*\*', '<strong>$1</strong>')
    $t = [regex]::Replace($t, '__(.+?)__', '<strong>$1</strong>')
    $t = [regex]::Replace($t, '(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', '<em>$1</em>')
    $t = [regex]::Replace($t, '(?<!_)_(?!_)(.+?)(?<!_)_(?!_)', '<em>$1</em>')
    $t = [regex]::Replace($t, '\[([^\]]+)\]\(([^)]+)\)', '<a href="$2">$1</a>')
    return $t
}

function Convert-Markdown($md) {
    $lines = $md -split "`r?`n"
    $html = New-Object System.Text.StringBuilder
    $inCode = $false
    $codeBuffer = New-Object System.Collections.Generic.List[string]
    $listType = $null
    $paraBuffer = New-Object System.Collections.Generic.List[string]

    $flushPara = {
        if ($paraBuffer.Count -gt 0) {
            $text = Format-Inline ([string]::Join(' ', $paraBuffer))
            [void]$html.Append("<p>$text</p>`n")
            $paraBuffer.Clear()
        }
    }
    $closeList = {
        if ($listType) {
            [void]$html.Append("</$listType>`n")
            $listType = $null
        }
    }

    foreach ($line in $lines) {
        if ($line -match '^\s*```') {
            if (-not $inCode) {
                . $flushPara; . $closeList
                $inCode = $true
                $codeBuffer.Clear()
            } else {
                $inCode = $false
                $code = [string]::Join("`n", $codeBuffer)
                $escaped = $code -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;'
                [void]$html.Append("<pre><code>$escaped</code></pre>`n")
            }
            continue
        }
        if ($inCode) { $codeBuffer.Add($line); continue }

        if ($line -match '^\s*$') {
            . $flushPara; . $closeList
            continue
        }

        if ($line -match '^(#{1,6})\s+(.*)$') {
            . $flushPara; . $closeList
            $level = $matches[1].Length
            $text = Format-Inline $matches[2]
            [void]$html.Append("<h$level>$text</h$level>`n")
            continue
        }

        if ($line -match '^>\s?(.*)$') {
            . $flushPara; . $closeList
            $text = Format-Inline $matches[1]
            [void]$html.Append("<blockquote><p>$text</p></blockquote>`n")
            continue
        }

        if ($line -match '^\s*[-*]\s+(.*)$') {
            . $flushPara
            if ($listType -ne 'ul') { . $closeList; [void]$html.Append("<ul>`n"); $listType = 'ul' }
            $text = Format-Inline $matches[1]
            [void]$html.Append("<li>$text</li>`n")
            continue
        }

        if ($line -match '^\s*\d+\.\s+(.*)$') {
            . $flushPara
            if ($listType -ne 'ol') { . $closeList; [void]$html.Append("<ol>`n"); $listType = 'ol' }
            $text = Format-Inline $matches[1]
            [void]$html.Append("<li>$text</li>`n")
            continue
        }

        if ($line -match '^(-{3,}|\*{3,})\s*$') {
            . $flushPara; . $closeList
            [void]$html.Append("<hr/>`n")
            continue
        }

        $paraBuffer.Add($line.Trim())
    }
    . $flushPara
    . $closeList
    return $html.ToString()
}

function Parse-Frontmatter($content) {
    if ($content -match '(?s)^---\r?\n(.*?)\r?\n---\r?\n(.*)$') {
        $fmText = $matches[1]
        $body = $matches[2]
        $meta = @{}
        foreach ($line in ($fmText -split "`r?`n")) {
            if ($line -match '^([\w]+):\s*(.*)$') {
                $meta[$matches[1]] = $matches[2].Trim()
            }
        }
        return [pscustomobject]@{ Meta = $meta; Body = $body }
    }
    return [pscustomobject]@{ Meta = @{}; Body = $content }
}

# --- Themen einlesen ---
$topics = @()
Get-ChildItem -Path $contentDir -Filter *.md | Sort-Object Name | ForEach-Object {
    $slug = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $raw = Get-Content -Raw -Path $_.FullName -Encoding UTF8
    $parsed = Parse-Frontmatter $raw
    $topics += [pscustomobject]@{
        Slug    = $slug
        Title   = $(if ($parsed.Meta.title) { $parsed.Meta.title } else { $slug })
        Emoji   = $(if ($parsed.Meta.emoji) { $parsed.Meta.emoji } else { "📄" })
        Summary = $(if ($parsed.Meta.summary) { $parsed.Meta.summary } else { "" })
        BodyHtml = Convert-Markdown $parsed.Body
    }
}
$staticSlugsJs = ($topics | ForEach-Object { '"' + $_.Slug + '"' }) -join ','

# --- Templates ---
function Get-Nav($activeSlug) {
    $items = foreach ($t in $topics) {
        $cls = if ($t.Slug -eq $activeSlug) { ' class="active"' } else { '' }
        "<a href=`"$($t.Slug).html`"$cls>$($t.Emoji) $($t.Title)</a>"
    }
    return [string]::Join("`n", $items)
}

function Get-Layout($title, $activeSlug, $bodyHtml) {
    $nav = Get-Nav $activeSlug
    return @"
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$title</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="index.html">
    <span class="brand-emoji">📚</span>
    <span class="brand-lockup">
      <span class="brand-title">Meine Themen</span>
      <span class="brand-sub">Persönliche Sammlung</span>
    </span>
  </a>
  <nav class="topnav">
    <a href="index.html">Übersicht</a>
    $nav
  </nav>
  <div class="auth-slot"></div>
</header>
<main>
$bodyHtml
</main>
<footer class="site-footer">
  <p>Persönliche Wissenssammlung</p>
</footer>
<script>window.STATIC_SLUGS = [$staticSlugsJs];</script>
<script type="module" src="assets/firebase-sync.js"></script>
<script type="module" src="assets/topics.js"></script>
<script type="module" src="assets/notebook.js"></script>
<script type="module" src="assets/dynamic-topic.js"></script>
</body>
</html>
"@
}

# --- Themen-Seiten schreiben ---
foreach ($t in $topics) {
    $pageHtml = @"
<article class="topic-page">
  <h1>$($t.Emoji) $($t.Title)</h1>
  $($t.BodyHtml)
</article>

<section class="notebook" data-slug="$($t.Slug)">
  <h2 class="notebook-heading">📝 Meine Notizen</h2>
  <p class="notebook-hint">Wird automatisch in diesem Browser gespeichert (nicht auf GitHub). Mit „Exportieren“ kannst du sie dauerhaft sichern.</p>
  <div class="notes-paper">
    <textarea class="notes-editor" rows="8" placeholder="Deine eigenen Notizen zu diesem Thema..."></textarea>
  </div>
  <div class="notes-toolbar">
    <span class="notes-status"></span>
    <button type="button" class="notes-export">Als Markdown exportieren</button>
  </div>

  <h2 class="notebook-heading">📎 Meine Dokumente</h2>
  <p class="notebook-hint">Links zu eigenen Dateien (z.B. Google Drive, OneDrive) anheften oder kleine Dateien (max. 3 MB) direkt einbetten.</p>

  <form class="attach-link-form">
    <input type="text" class="attach-link-title" placeholder="Titel" required>
    <input type="url" class="attach-link-url" placeholder="https://..." required>
    <button type="submit">Link anheften</button>
  </form>

  <div class="attach-file-row">
    <label class="attach-file-label">
      Datei einbetten (max. 3 MB)
      <input type="file" class="attach-file-input">
    </label>
    <span class="attach-file-status"></span>
  </div>

  <div class="attachment-list"></div>
</section>
"@
    $full = Get-Layout $t.Title $t.Slug $pageHtml
    Set-Content -Path (Join-Path $outDir "$($t.Slug).html") -Value $full -Encoding UTF8
}

# --- Startseite schreiben ---
$cards = foreach ($t in $topics) {
    @"
<a class="card" href="$($t.Slug).html">
  <div class="card-emoji">$($t.Emoji)</div>
  <h2>$($t.Title)</h2>
  <p>$($t.Summary)</p>
</a>
"@
}
$indexBody = @"
<section class="intro">
  <h1>Meine Themen</h1>
  <p>Übersicht aller Bereiche. Klicke auf ein Thema, um die Notizen zu öffnen.</p>
</section>
<section class="card-grid">
$([string]::Join("`n", $cards))
<div class="card card-add">
  <button type="button" class="add-topic-button">+ Neues Thema</button>
  <form class="add-topic-form">
    <input type="text" class="add-topic-title" placeholder="Titel" required>
    <div class="emoji-field">
      <input type="text" class="add-topic-emoji" placeholder="Emoji (optional)" maxlength="4">
      <button type="button" class="emoji-picker-toggle" title="Emoji auswählen">😀</button>
      <div class="emoji-picker-popup"></div>
    </div>
    <input type="text" class="add-topic-summary" placeholder="Kurzbeschreibung (optional)">
    <button type="submit">Anlegen</button>
  </form>
  <p class="card-add-hint">Wird nur in diesem Browser gespeichert.</p>
</div>
</section>
"@
$indexFull = Get-Layout "Meine Themen – Übersicht" $null $indexBody
Set-Content -Path (Join-Path $outDir "index.html") -Value $indexFull -Encoding UTF8

# --- Generische Seite fuer selbst angelegte Themen ---
$dynamicBody = @"
<div id="dynamic-topic">
  <p class="notebook-hint">Lade Thema…</p>
</div>
"@
$dynamicFull = Get-Layout "Thema" $null $dynamicBody
Set-Content -Path (Join-Path $outDir "topic.html") -Value $dynamicFull -Encoding UTF8

Write-Host "Fertig: $($topics.Count) Themen-Seiten + index.html wurden in '$outDir' erzeugt." -ForegroundColor Green








