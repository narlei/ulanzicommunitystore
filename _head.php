<?php
require_once __DIR__ . '/lib.php';
/** @var string $page_title */
$page_title = $page_title ?? STORE_NAME;
$lang = current_lang();
$html_lang = ['en' => 'en', 'pt' => 'pt-BR', 'zh' => 'zh-CN'][$lang] ?? 'en';
?><!doctype html>
<html lang="<?= e($html_lang) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($page_title) ?></title>
<meta name="description" content="<?= e(t('tagline')) ?>">
<link rel="stylesheet" href="/assets/style.css">
<script>
window.STORE_CONFIG = <?= config_js() ?>;
window.STORE_I18N = <?= i18n_js() ?>;
</script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/">
      <span class="brand-mark">◈</span>
      <span class="brand-name"><?= e(STORE_NAME) ?></span>
    </a>
    <nav class="header-nav">
      <a href="/publish.php"><?= e(t('nav.publish')) ?></a>
      <a href="<?= e(REGISTRY_REPO_URL) ?>" target="_blank" rel="noopener">GitHub</a>
      <span class="lang-switch">
        <?php foreach (LANGS as $code): ?>
          <a href="<?= e(lang_url($code)) ?>"
             class="lang-opt<?= $code === $lang ? ' is-active' : '' ?>"><?= e(LANG_NAMES[$code]) ?></a>
        <?php endforeach; ?>
      </span>
    </nav>
  </div>
</header>
<main class="wrap">
