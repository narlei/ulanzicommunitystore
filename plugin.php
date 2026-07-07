<?php
require_once __DIR__ . '/lib.php';
$id = $_GET['id'] ?? '';
$p = find_plugin($id);
if (!$p) {
    http_response_code(404);
    $page_title = t('plugin.not_found', '') . ' — ' . STORE_NAME;
    require __DIR__ . '/_head.php';
    echo '<p class="empty">' . t('plugin.not_found', '<a href="/">' . e(t('plugin.back')) . '</a>') . '</p>';
    require __DIR__ . '/_foot.php';
    exit;
}
$name = loc_text($p, 'name');
$page_title = $name . ' — ' . STORE_NAME;
require __DIR__ . '/_head.php';
?>
<article class="detail"
         data-plugin-id="<?= e($p['id']) ?>"
         data-repo="<?= e($p['repo']) ?>"
         data-version="<?= e($p['version']) ?>">
  <header class="detail-head">
    <?php if (!empty($p['icon'])): ?>
      <img class="detail-icon" src="<?= e($p['icon']) ?>" alt="">
    <?php endif; ?>
    <div class="detail-head-text">
      <h1><?= e($name) ?></h1>
      <p class="card-author"><?= t('card.by', '<span>' . e($p['author']) . '</span>') ?> · v<?= e($p['version']) ?></p>
      <div class="card-meta">
        <?php foreach (($p['deviceTypes'] ?? []) as $d): ?>
          <span class="chip chip-device"><?= e(device_label($d)) ?></span>
        <?php endforeach; ?>
        <?php foreach (($p['platforms'] ?? []) as $pl): ?>
          <span class="chip"><?= e(platform_label($pl)) ?></span>
        <?php endforeach; ?>
        <?php if (!empty($p['category'])): ?>
          <span class="chip chip-muted"><?= e($p['category']) ?></span>
        <?php endif; ?>
      </div>
    </div>
    <div class="detail-actions">
      <button type="button" class="btn btn-install btn-lg" data-install><?= e(t('btn.install')) ?></button>
      <span class="badge badge-update" data-update-badge hidden><?= e(t('plugin.update_avail')) ?></span>
      <span class="install-status" data-status></span>
      <a class="btn btn-ghost" href="<?= e($p['sourceUrl']) ?>" target="_blank" rel="noopener"><?= e(t('plugin.source')) ?></a>
    </div>
  </header>

  <?php if (!empty($p['screenshots'])): ?>
    <section class="shots">
      <?php foreach ($p['screenshots'] as $s): ?>
        <img src="<?= e($s) ?>" alt="" loading="lazy">
      <?php endforeach; ?>
    </section>
  <?php endif; ?>

  <section class="detail-cols">
    <div class="detail-main">
      <h2><?= e(t('plugin.about')) ?></h2>
      <p class="longdesc"><?= nl2br(e(loc_text($p, 'longDescription'))) ?></p>

      <?php if (!empty($p['changelog'])): ?>
        <h2><?= e(t('plugin.whats_new', $p['releaseTag'])) ?></h2>
        <pre class="changelog"><?= e($p['changelog']) ?></pre>
      <?php endif; ?>
    </div>
    <aside class="detail-side">
      <h3><?= e(t('plugin.details')) ?></h3>
      <dl>
        <dt><?= e(t('plugin.version')) ?></dt><dd><?= e($p['version']) ?></dd>
        <?php if (!empty($p['minSoftwareVersion'])): ?>
          <dt><?= e(t('plugin.min_sw')) ?></dt><dd><?= e($p['minSoftwareVersion']) ?></dd>
        <?php endif; ?>
        <?php if (!empty($p['languages'])): ?>
          <dt><?= e(t('plugin.languages')) ?></dt><dd><?= e(implode(', ', $p['languages'])) ?></dd>
        <?php endif; ?>
        <?php if (!empty($p['publishedAt'])): ?>
          <dt><?= e(t('plugin.published')) ?></dt><dd><?= e(substr($p['publishedAt'], 0, 10)) ?></dd>
        <?php endif; ?>
      </dl>
    </aside>
  </section>
</article>
<?php require __DIR__ . '/_foot.php'; ?>
