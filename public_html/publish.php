<?php
require_once __DIR__ . '/lib.php';
$page_title = t('publish.title') . ' — ' . STORE_NAME;
require __DIR__ . '/_head.php';
?>
<article class="publish">
  <header class="publish-hero">
    <h1><?= e(t('publish.title')) ?></h1>
    <p><?= t('publish.hero_html') ?></p>
  </header>

  <ol class="pub-steps">

    <li class="pub-step">
      <div class="pub-num">1</div>
      <div class="pub-content">
        <h2><?= e(t('publish.s1.title')) ?></h2>
        <p class="pub-lead"><?= t('publish.s1.lead_html') ?></p>
        <pre class="code">com.you.myplugin.ulanziPlugin/
├─ manifest.json        # name, version, icon, actions
├─ resources/icon.png   # plugin icon (square PNG)
├─ en.json  pt_BR.json  # languages (optional)
└─ plugin/app.js        # your code</pre>
      </div>
    </li>

    <li class="pub-step">
      <div class="pub-num">2</div>
      <div class="pub-content">
        <h2><?= e(t('publish.s2.title')) ?></h2>
        <p class="pub-lead"><?= t('publish.s2.lead_html') ?></p>
        <pre class="code">Release v1.0.0
└─ com.you.myplugin.ulanziPlugin.zip   ✅</pre>
        <p class="pub-hint"><?= t('publish.s2.hint_html', e(REGISTRY_REPO_URL)) ?></p>
      </div>
    </li>

    <li class="pub-step">
      <div class="pub-num">3</div>
      <div class="pub-content">
        <h2><?= e(t('publish.s3.title')) ?> <span class="pub-opt"><?= e(t('publish.opt')) ?></span></h2>
        <p class="pub-lead"><?= t('publish.s3.lead_html') ?></p>
        <pre class="code">{
  "cover": "resources/cover.png",
  "screenshots": ["resources/shot1.png", "resources/shot2.png"],
  "longDescription": "What your plugin does, in a line or two.",
  "deviceTypes": ["deck", "dial"],
  "tags": ["productivity"]
}</pre>
        <p class="pub-hint"><?= e(t('publish.s3.hint')) ?></p>
      </div>
    </li>

    <li class="pub-step">
      <div class="pub-num">4</div>
      <div class="pub-content">
        <h2><?= e(t('publish.s4.title')) ?></h2>
        <p class="pub-lead"><?= t('publish.s4.lead_html') ?></p>
        <pre class="code"><span class="code-path">registry/plugins/you__myplugin.json</span>
{ "repo": "you/myplugin" }</pre>
        <p class="pub-hint"><?= t('publish.s4.hint_html') ?></p>
      </div>
    </li>

  </ol>

  <div class="pub-cta">
    <a class="btn btn-lg" href="<?= e(REGISTRY_REPO_URL) ?>/tree/main/registry" target="_blank" rel="noopener"><?= e(t('publish.cta')) ?></a>
    <p class="muted"><?= t('publish.devmode_html') ?></p>
  </div>
</article>
<?php require __DIR__ . '/_foot.php'; ?>
