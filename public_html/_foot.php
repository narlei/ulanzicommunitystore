</main>

<div id="helper-modal" class="modal" hidden>
  <div class="modal-backdrop" data-modal-close></div>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="helper-modal-title">
    <button type="button" class="modal-x" data-modal-close aria-label="×">&times;</button>
    <h2 id="helper-modal-title"><?= e(t('modal.title')) ?></h2>
    <p class="modal-lead"><?= t('modal.lead_html') ?></p>
    <ol class="steps">
      <li>
        <span class="step-n">1</span>
        <div class="step-body">
          <?= e(t('modal.step1')) ?>
          <div class="cmd-row">
            <code id="helper-cmd"></code>
            <button type="button" class="btn btn-sm" data-copy-cmd><?= e(t('modal.copy')) ?></button>
          </div>
        </div>
      </li>
      <li>
        <span class="step-n">2</span>
        <div class="step-body"><?= t('modal.step2_html') ?></div>
      </li>
      <li>
        <span class="step-n">3</span>
        <div class="step-body"><?= t('modal.step3_html') ?></div>
      </li>
      <li>
        <span class="step-n">4</span>
        <div class="step-body"><?= t('modal.step4_html') ?></div>
      </li>
    </ol>
    <div class="modal-actions">
      <button type="button" class="btn" data-retry-helper><?= e(t('modal.retry')) ?></button>
      <span class="install-status" data-retry-status></span>
    </div>
  </div>
</div>

<footer class="site-footer">
  <div class="wrap">
    <p class="disclaimer"><?= e(t('disclaimer')) ?></p>
    <p class="muted"><?= e(t('footer.auto')) ?></p>
  </div>
</footer>
<script src="/assets/app.js"></script>
</body>
</html>
