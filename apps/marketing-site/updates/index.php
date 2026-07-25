<?php
// Server-side Open Graph / Twitter Card injection for shared /updates/ links.
//
// Same idea as plugins/index.php: crawlers (Discord, Slack, WhatsApp, X, …) don't run
// JavaScript, so a shared ?from=&to= link would otherwise unfurl as the generic page.
// This reads index.html as the single source of markup and swaps only <title> +
// description/OG/Twitter meta for a summary of that exact window — "3 new plugins and
// 2 updates · 17–24 Jul 2026" — computed from the same catalog.json the page uses.
//
// Bad/missing dates or a catalog fetch failure → the untouched template.

$CATALOG_URL = 'https://narlei.github.io/ulanzicommunitystore/catalog.json';
$BASE_URL = 'https://ulanzicommunitystore.narlei.com/updates/';
$CACHE_TTL = 600; // seconds; crawls are bursty, don't hit Pages on every hit
$DEFAULT_WINDOW_DAYS = 7;

$template = file_get_contents(__DIR__ . '/index.html');
if ($template === false) {
    serveTemplate($template);
}

// Mirrors readWindow() in updates.js: explicit ?from=&to= wins, otherwise the last 7 days
// ending today. Both are plain UTC dates so a link means the same thing everywhere.
$from = isset($_GET['from']) ? trim((string) $_GET['from']) : '';
$to = isset($_GET['to']) ? trim((string) $_GET['to']) : '';
if (!isValidYmd($from) || !isValidYmd($to) || $from > $to) {
    $to = gmdate('Y-m-d');
    $from = gmdate('Y-m-d', strtotime($to . ' -' . ($DEFAULT_WINDOW_DAYS - 1) . ' days'));
}

$catalog = loadCatalog($CATALOG_URL, $CACHE_TTL);
if (!is_array($catalog) || empty($catalog['plugins'])) {
    serveTemplate($template);
}

$counts = countWindow($catalog['plugins'], $from, $to);
// An empty window is a real answer, but it makes a poor share card — leave the generic
// one so a mistyped range doesn't unfurl as "0 new plugins".
if ($counts['new'] === 0 && $counts['updated'] === 0) {
    serveTemplate($template);
}

$range = formatRange($from, $to);
$title = "What's new · " . $range . ' — Ulanzi Community Store';
$description = trim(
    plural($counts['new'], 'new plugin', 'new plugins')
    . ' and ' . plural($counts['updated'], 'update', 'updates')
    . ' in the Ulanzi Community Store, ' . $range . '.'
    . ' ' . namesLine($counts['names'])
);

serveTemplate(injectMeta($template, array(
    'title' => $title,
    'description' => $description,
    'url' => $BASE_URL . '?from=' . rawurlencode($from) . '&to=' . rawurlencode($to),
)));

// ---------------------------------------------------------------------------

function serveTemplate($html)
{
    header('Content-Type: text/html; charset=utf-8');
    // Same policy as .htaccess for .html: shared links must pick up changes quickly.
    header('Cache-Control: public, max-age=0, must-revalidate');
    echo $html === false ? '' : $html;
    exit;
}

function isValidYmd($value)
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return false;
    }
    list($y, $m, $d) = array_map('intval', explode('-', $value));
    return checkdate($m, $d, $y);
}

function inWindow($iso, $from, $to)
{
    if (!is_string($iso) || $iso === '') {
        return false;
    }
    $ts = strtotime($iso);
    if ($ts === false) {
        return false;
    }
    return $ts >= strtotime($from . ' 00:00:00 UTC') && $ts <= strtotime($to . ' 23:59:59 UTC');
}

// Same partition as updates.js: `addedAt` inside the window means the plugin entered the
// store then; otherwise any release inside the window counts as an update. Entries built
// before the catalog carried `releases` fall back to their latest release.
function countWindow($plugins, $from, $to)
{
    $new = 0;
    $updated = 0;
    $names = array();

    foreach ($plugins as $p) {
        $releases = (isset($p['releases']) && is_array($p['releases']) && $p['releases'])
            ? $p['releases']
            : array(array('publishedAt' => isset($p['publishedAt']) ? $p['publishedAt'] : ''));

        $shipped = false;
        foreach ($releases as $r) {
            if (inWindow(isset($r['publishedAt']) ? $r['publishedAt'] : '', $from, $to)) {
                $shipped = true;
                break;
            }
        }

        if (inWindow(isset($p['addedAt']) ? $p['addedAt'] : '', $from, $to)) {
            $new++;
            $names[] = englishName($p);
        } elseif ($shipped) {
            $updated++;
        }
    }

    return array('new' => $new, 'updated' => $updated, 'names' => $names);
}

// English-only card, as the share audience is global.
function englishName($plugin)
{
    if (isset($plugin['i18n']['en']['name']) && trim($plugin['i18n']['en']['name']) !== '') {
        return trim($plugin['i18n']['en']['name']);
    }
    return isset($plugin['name']) ? trim($plugin['name']) : '';
}

function plural($n, $one, $many)
{
    return $n . ' ' . ($n === 1 ? $one : $many);
}

// Names the first few new plugins — a card that says what actually landed beats one that
// only counts. Cut short so the description stays inside the crawler's preview.
function namesLine($names)
{
    $names = array_values(array_filter($names, 'strlen'));
    if (!$names) {
        return '';
    }
    $shown = array_slice($names, 0, 4);
    $line = implode(', ', $shown);
    $rest = count($names) - count($shown);
    if ($rest > 0) {
        $line .= ' and ' . $rest . ' more';
    }
    return 'New: ' . $line . '.';
}

// "17–24 Jul 2026", collapsing the repeated month/year when both ends share it.
function formatRange($from, $to)
{
    $a = strtotime($from . ' 00:00:00 UTC');
    $b = strtotime($to . ' 00:00:00 UTC');
    if ($from === $to) {
        return gmdate('j M Y', $a);
    }
    if (gmdate('Y', $a) === gmdate('Y', $b)) {
        if (gmdate('m', $a) === gmdate('m', $b)) {
            return gmdate('j', $a) . '–' . gmdate('j M Y', $b);
        }
        return gmdate('j M', $a) . ' – ' . gmdate('j M Y', $b);
    }
    return gmdate('j M Y', $a) . ' – ' . gmdate('j M Y', $b);
}

// catalog.json via a small temp-dir cache, shared with plugins/index.php. A fetch failure
// falls back to a stale cache when one exists; with no cache at all it returns null.
function loadCatalog($url, $ttl)
{
    $cacheFile = sys_get_temp_dir() . '/ucs-catalog-cache.json';

    $stat = @stat($cacheFile);
    if ($stat && time() - $stat['mtime'] < $ttl) {
        $cached = @file_get_contents($cacheFile);
        if ($cached !== false) {
            $json = json_decode($cached, true);
            if (is_array($json)) {
                return $json;
            }
        }
    }

    $ctx = stream_context_create(array('http' => array(
        'timeout' => 5,
        'ignore_errors' => false,
        'header' => "Cache-Control: no-cache\r\nPragma: no-cache\r\n",
    )));
    $body = @file_get_contents($url, false, $ctx);
    if ($body !== false) {
        $json = json_decode($body, true);
        if (is_array($json)) {
            @file_put_contents($cacheFile, $body, LOCK_EX);
            return $json;
        }
    }

    $cached = @file_get_contents($cacheFile);
    if ($cached !== false) {
        $json = json_decode($cached, true);
        if (is_array($json)) {
            return $json;
        }
    }
    return null;
}

// Swaps the template's <title>, description, canonical and OG/Twitter meta. The image is
// left alone — the template already points at the 1200×630 site cover. A pattern that
// doesn't match (template drift) is skipped; the page still works with partial meta.
function injectMeta($html, $meta)
{
    $title = htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8');
    $desc = htmlspecialchars(truncate($meta['description'], 300), ENT_QUOTES, 'UTF-8');
    $url = htmlspecialchars($meta['url'], ENT_QUOTES, 'UTF-8');

    $swaps = array(
        '#<title>.*?</title>#s' => "<title>$title</title>",
        '#<meta name="description" content="[^"]*">#' => "<meta name=\"description\" content=\"$desc\">",
        '#<link rel="canonical" href="[^"]*">#' => "<link rel=\"canonical\" href=\"$url\">",
        '#<meta property="og:title" content="[^"]*">#' => "<meta property=\"og:title\" content=\"$title\">",
        '#<meta property="og:description" content="[^"]*">#' => "<meta property=\"og:description\" content=\"$desc\">",
        '#<meta property="og:url" content="[^"]*">#' => "<meta property=\"og:url\" content=\"$url\">",
        '#<meta name="twitter:title" content="[^"]*">#' => "<meta name=\"twitter:title\" content=\"$title\">",
        '#<meta name="twitter:description" content="[^"]*">#' => "<meta name=\"twitter:description\" content=\"$desc\">",
    );

    foreach ($swaps as $pattern => $replacement) {
        $swapped = preg_replace($pattern, $replacement, $html, 1);
        if ($swapped !== null) {
            $html = $swapped;
        }
    }
    return $html;
}

// Cuts at a word boundary with an ellipsis; crawler-facing descriptions stay short.
function truncate($s, $max)
{
    if (function_exists('mb_strlen') ? mb_strlen($s) <= $max : strlen($s) <= $max) {
        return $s;
    }
    $cut = function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
    $space = strrpos($cut, ' ');
    if ($space !== false && $space > $max * 0.6) {
        $cut = substr($cut, 0, $space);
    }
    return rtrim($cut, " \t.,;:—-") . '…';
}
