<?php
// Utilitários compartilhados: carregar o catálogo e escapar saída.

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/i18n.php';

function load_catalog(): array {
    $path = __DIR__ . '/catalog.json';
    if (!is_file($path)) {
        return ['generatedAt' => null, 'count' => 0, 'plugins' => []];
    }
    $data = json_decode(file_get_contents($path), true);
    if (!is_array($data) || !isset($data['plugins'])) {
        return ['generatedAt' => null, 'count' => 0, 'plugins' => []];
    }
    return $data;
}

function find_plugin(string $id): ?array {
    foreach (load_catalog()['plugins'] as $p) {
        if (($p['id'] ?? null) === $id) {
            return $p;
        }
    }
    return null;
}

// Escape HTML (contexto de texto/atributo).
function e($v): string {
    return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8');
}

// Rótulo amigável para tipo de device.
function device_label(string $t): string {
    return match ($t) {
        'deck'  => 'Deck',
        'dial'  => 'Dial',
        default => ucfirst($t),
    };
}

// Rótulo amigável para plataforma.
function platform_label(string $p): string {
    return match (strtolower($p)) {
        'mac', 'macos', 'darwin' => 'macOS',
        'win', 'windows'         => 'Windows',
        default                  => ucfirst($p),
    };
}

function config_js(): string {
    return json_encode([
        'portBase'     => HELPER_PORT_BASE,
        'portCount'    => HELPER_PORT_COUNT,
        'installSh'    => HELPER_INSTALL_SH,
    ], JSON_UNESCAPED_SLASHES);
}

// Strings usadas pelo app.js (feedback de instalação, botões dinâmicos).
function i18n_js(): string {
    return json_encode([
        'install'       => t('btn.install'),
        'update'        => t('btn.update_action'),
        'installed'     => t('btn.installed'),
        'installing'    => t('js.installing'),
        'searching'     => t('js.searching'),
        'done'          => t('js.done'),
        'installedV'    => t('js.installed_v'),
        'blocked'       => t('js.blocked'),
        'errorPrefix'   => t('js.error'),
        'retryNotFound' => t('js.retry_not_found'),
        'copy'          => t('modal.copy'),
        'copied'        => t('js.copied'),
        'copyManual'    => t('js.copy_manual'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
