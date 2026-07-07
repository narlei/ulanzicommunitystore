<?php
require_once __DIR__ . '/lib.php';
$catalog = load_catalog();
$plugins = $catalog['plugins'];
$page_title = STORE_NAME . ' — ' . t('tagline');

// Deriva os filtros a partir do próprio catálogo.
$devices = [];
foreach ($plugins as $p) {
    foreach (($p['deviceTypes'] ?? []) as $d) {
        $devices[$d] = true;
    }
}
$devices = array_keys($devices);
sort($devices);

require __DIR__ . '/_head.php';
?>
<section class="hero">
  <h1><?= t('hero.title', '<span class="accent">' . e(t('hero.deck')) . '</span>', '<span class="accent">' . e(t('hero.dial')) . '</span>') ?></h1>
  <p class="hero-sub"><?= e(t('hero.sub')) ?></p>
</section>

<?php if (empty($plugins)): ?>
  <p class="empty"><?= t('empty.no_plugins', '<a href="/publish.php">' . e(t('empty.be_first')) . '</a>') ?></p>
<?php else: ?>
  <section class="toolbar" id="toolbar">
    <div class="search">
      <input type="search" id="search" placeholder="<?= e(t('search.placeholder')) ?>" autocomplete="off" spellcheck="false">
    </div>
    <?php if (!empty($devices)): ?>
      <div class="filter-group" data-group="device" role="group" aria-label="device">
        <button type="button" class="pill is-active" data-value=""><?= e(t('filter.all')) ?></button>
        <?php foreach ($devices as $d): ?>
          <button type="button" class="pill" data-value="<?= e($d) ?>"><?= e(device_label($d)) ?></button>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>

  <section class="grid" id="plugin-grid">
    <?php foreach ($plugins as $p): ?>
      <?php
        $name = loc_text($p, 'name');
        $desc = loc_text($p, 'description');
        $haystack = mb_strtolower(implode(' ', array_filter([
            $name,
            $p['author'] ?? '',
            $desc,
            $p['category'] ?? '',
            implode(' ', $p['tags'] ?? []),
        ])));
      ?>
      <article class="card"
               data-plugin-id="<?= e($p['id']) ?>"
               data-repo="<?= e($p['repo']) ?>"
               data-version="<?= e($p['version']) ?>"
               data-device="<?= e(implode(' ', $p['deviceTypes'] ?? [])) ?>"
               data-search="<?= e($haystack) ?>">
        <a class="card-media" href="/plugin.php?id=<?= urlencode($p['id']) ?>">
          <?php if (!empty($p['cover'])): ?>
            <img src="<?= e($p['cover']) ?>" alt="" loading="lazy">
          <?php else: ?>
            <span class="card-media-fallback">◈</span>
          <?php endif; ?>
        </a>
        <div class="card-body">
          <div class="card-head">
            <h2 class="card-title">
              <a href="/plugin.php?id=<?= urlencode($p['id']) ?>"><?= e($name) ?></a>
            </h2>
            <span class="badge badge-update" data-update-badge hidden><?= e(t('badge.update')) ?></span>
          </div>
          <p class="card-author"><?= t('card.by', '<span>' . e($p['author']) . '</span>') ?></p>
          <p class="card-desc"><?= e(mb_strimwidth($desc, 0, 140, '…')) ?></p>
          <div class="card-meta">
            <?php foreach (($p['deviceTypes'] ?? []) as $d): ?>
              <span class="chip chip-device"><?= e(device_label($d)) ?></span>
            <?php endforeach; ?>
            <?php foreach (($p['platforms'] ?? []) as $pl): ?>
              <span class="chip"><?= e(platform_label($pl)) ?></span>
            <?php endforeach; ?>
            <?php if (!empty($p['languages'])): ?>
              <span class="chip chip-muted"><?= e(t('card.langs', count($p['languages']))) ?></span>
            <?php endif; ?>
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-install" data-install><?= e(t('btn.install')) ?></button>
            <span class="install-status" data-status></span>
          </div>
        </div>
      </article>
    <?php endforeach; ?>
  </section>
  <p class="empty" id="no-results" hidden><?= e(t('empty.no_results')) ?></p>
<?php endif; ?>

<?php require __DIR__ . '/_foot.php'; ?>
