<?php
// Server-side Open Graph / Twitter Card injection for shared plugin links.
//
// Social crawlers (X/Twitter, WhatsApp, Discord, Slack, …) don't run JavaScript, so a
// shared /plugins/?plugin=owner/name link would otherwise show the generic catalog
// card. This script keeps index.html as the single source of markup: it reads the
// template, and when ?plugin= matches a catalog entry it swaps only the <title> +
// description/OG/Twitter meta for that plugin (name, description, generated 1200×630
// banner). Humans get the exact same page — catalog.js opens the detail sheet client-side.
//
// No ?plugin=, unknown plugin, or catalog fetch failure → the untouched template.

$CATALOG_URL = 'https://narlei.github.io/ulanzicommunitystore/catalog.json';
$BASE_URL = 'https://ulanzicommunitystore.narlei.com/plugins/';
$CACHE_TTL = 600; // seconds; crawls are bursty, don't hit Pages on every hit

$template = file_get_contents(__DIR__ . '/index.html');

$repo = isset($_GET['plugin']) ? trim((string) $_GET['plugin']) : '';
// owner/name only — anything else is not a repo and gets the default page.
if ($template === false || !preg_match('#^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$#', $repo)) {
    serveTemplate($template);
}

$plugin = findPlugin(loadCatalog($CATALOG_URL, $CACHE_TTL), $repo);
if (!$plugin) {
    serveTemplate($template);
}

// English-only card, as the share audience is global.
$en = isset($plugin['i18n']['en']) ? $plugin['i18n']['en'] : array();
$name = firstNonEmpty(array(isset($en['name']) ? $en['name'] : '', $plugin['name']), 'Ulanzi Deck plugin');
$description = firstNonEmpty(
    array(isset($en['description']) ? $en['description'] : '', $plugin['description']),
    'A community plugin for the Ulanzi Deck.'
);
$title = $name . ' — Ulanzi Community Store';
$descriptionCard = $description . ' Get it free on the Ulanzi Community Store.';
$shareUrl = $BASE_URL . '?plugin=' . rawurlencode($plugin['repo']);

// Prefer the generated 1200×630 banner; fall back to the plugin icon (small card).
$ogImage = firstNonEmpty(array(
    isset($plugin['ogImage']) ? $plugin['ogImage'] : '',
    isset($plugin['icon']) ? $plugin['icon'] : '',
), '');
$largeCard = !empty($plugin['ogImage']);

serveTemplate(injectMeta($template, array(
    'title' => $title,
    'description' => $descriptionCard,
    'url' => $shareUrl,
    'image' => $ogImage,
    'largeCard' => $largeCard,
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

// catalog.json via a small temp-dir cache. A fetch failure falls back to a stale
// cache when one exists; with no cache at all it returns null (→ default page).
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

    $ctx = stream_context_create(array('http' => array('timeout' => 5, 'ignore_errors' => false)));
    $body = @file_get_contents($url, false, $ctx);
    if ($body !== false) {
        $json = json_decode($body, true);
        if (is_array($json)) {
            @file_put_contents($cacheFile, $body, LOCK_EX);
            return $json;
        }
    }

    // Fetch failed — serve stale cache if we have one.
    $cached = @file_get_contents($cacheFile);
    if ($cached !== false) {
        $json = json_decode($cached, true);
        if (is_array($json)) {
            return $json;
        }
    }
    return null;
}

function findPlugin($catalog, $repo)
{
    if (!is_array($catalog) || empty($catalog['plugins'])) {
        return null;
    }
    foreach ($catalog['plugins'] as $p) {
        if (isset($p['repo']) && strcasecmp($p['repo'], $repo) === 0) {
            return $p;
        }
    }
    return null;
}

function firstNonEmpty($candidates, $fallback)
{
    foreach ($candidates as $c) {
        if (is_string($c) && trim($c) !== '') {
            return trim($c);
        }
    }
    return $fallback;
}

// Swaps the template's <title>, description, canonical and OG/Twitter meta for the
// plugin's. Each replacement targets one specific tag; a pattern that doesn't match
// (template drift) is simply skipped — the page still works with partial meta.
function injectMeta($html, $meta)
{
    $title = htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8');
    $desc = htmlspecialchars(truncate($meta['description'], 300), ENT_QUOTES, 'UTF-8');
    $url = htmlspecialchars($meta['url'], ENT_QUOTES, 'UTF-8');
    $image = htmlspecialchars($meta['image'], ENT_QUOTES, 'UTF-8');
    $card = $meta['largeCard'] ? 'summary_large_image' : 'summary';

    $swaps = array(
        '#<title>.*?</title>#s' => "<title>$title</title>",
        '#<meta name="description" content="[^"]*">#' => "<meta name=\"description\" content=\"$desc\">",
        '#<link rel="canonical" href="[^"]*">#' => "<link rel=\"canonical\" href=\"$url\">",
        '#<meta property="og:title" content="[^"]*">#' => "<meta property=\"og:title\" content=\"$title\">",
        '#<meta property="og:description" content="[^"]*">#' => "<meta property=\"og:description\" content=\"$desc\">",
        '#<meta property="og:url" content="[^"]*">#' => "<meta property=\"og:url\" content=\"$url\">",
        '#<meta name="twitter:card" content="[^"]*">#' => "<meta name=\"twitter:card\" content=\"$card\">",
        '#<meta name="twitter:title" content="[^"]*">#' => "<meta name=\"twitter:title\" content=\"$title\">",
        '#<meta name="twitter:description" content="[^"]*">#' => "<meta name=\"twitter:description\" content=\"$desc\">",
    );
    if ($image !== '') {
        $dims = $meta['largeCard']
            ? "\n    <meta property=\"og:image:width\" content=\"1200\">\n    <meta property=\"og:image:height\" content=\"630\">"
            : '';
        $swaps['#<meta property="og:image" content="[^"]*">#'] = "<meta property=\"og:image\" content=\"$image\">$dims";
        $swaps['#<meta name="twitter:image" content="[^"]*">#'] = "<meta name=\"twitter:image\" content=\"$image\">";
    }

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
