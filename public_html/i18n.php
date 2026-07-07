<?php
// i18n do site: EN / PT / ZH. Strings da interface + helpers de idioma.
// Strings com sufixo _html contêm marcação e devem ser ecoadas sem escapar.

const LANGS = ['en', 'pt', 'zh'];
const LANG_NAMES = ['en' => 'EN', 'pt' => 'PT', 'zh' => '中文'];

// Mapeia o idioma do site para os locales dos arquivos de idioma dos plugins (com fallback).
const LANG_PLUGIN_LOCALES = [
    'en' => ['en'],
    'pt' => ['pt_BR', 'pt'],
    'zh' => ['zh_CN', 'zh_HK', 'zh_TW'],
];

const I18N = [
    'en' => [
        'tagline'            => 'Unofficial plugin store for Ulanzi Deck and Dial',
        'nav.publish'        => 'Publish',
        'hero.title'         => 'Plugins for %s and %s',
        'hero.deck'          => 'Ulanzi Deck',
        'hero.dial'          => 'Dial',
        'hero.sub'           => 'One-click install and updates. Fast publishing for devs — just point to the repo.',
        'search.placeholder' => 'Search plugins…',
        'filter.all'         => 'All',
        'card.by'            => 'by %s',
        'card.langs'         => '%d languages',
        'badge.update'       => 'update',
        'btn.install'        => 'Install',
        'btn.update_action'  => 'Update',
        'btn.installed'      => 'Installed ✓',
        'js.installing'      => 'Installing…',
        'js.searching'       => 'Looking for the Helper…',
        'js.done'            => 'done — restart Ulanzi Studio if needed',
        'js.installed_v'     => 'installed v%s',
        'js.blocked'         => 'blocked: repo not in the registry',
        'js.error'           => 'error %s',
        'js.retry_not_found' => 'Still not found. Make sure the command finished successfully.',
        'js.copied'          => 'Copied ✓',
        'js.copy_manual'     => 'Copy manually',
        'empty.no_plugins'   => 'No plugins in the catalog yet. %s',
        'empty.be_first'     => 'Be the first to publish.',
        'empty.no_results'   => 'No plugins found. Try another search.',
        'plugin.about'       => 'About',
        'plugin.whats_new'   => 'What’s new — %s',
        'plugin.details'     => 'Details',
        'plugin.version'     => 'Version',
        'plugin.min_sw'      => 'Minimum UlanziDeck',
        'plugin.languages'   => 'Languages',
        'plugin.published'   => 'Published',
        'plugin.source'      => 'Source code',
        'plugin.update_avail'=> 'update available',
        'plugin.not_found'   => 'Plugin not found. %s',
        'plugin.back'        => 'Back to catalog.',
        'footer.auto'        => 'Catalog updated automatically from GitHub releases.',
        'disclaimer'         => 'Independent, unofficial project. Not affiliated with, endorsed by, or maintained by Ulanzi. “Ulanzi”, “UlanziDeck” and “Ulanzi Dial” are trademarks of their respective owners.',
        // modal
        'modal.title'        => 'Activate the Helper to install',
        'modal.lead_html'    => 'The browser can’t install plugins by itself. Run this command <strong>just once</strong> to activate the Helper — after that it’s all one click, right here.',
        'modal.step1'        => 'Copy the command:',
        'modal.step2_html'   => 'Open the <strong>Terminal</strong> (press <kbd>⌘</kbd>+<kbd>Space</kbd>, type <em>Terminal</em> and Enter).',
        'modal.step3_html'   => 'Paste (<kbd>⌘</kbd>+<kbd>V</kbd>) and press <strong>Enter</strong>. Wait for the success message.',
        'modal.step4_html'   => 'Come back here and click <strong>Install</strong> again.',
        'modal.copy'         => 'Copy',
        'modal.retry'        => 'I’ve installed it — try again',
        // publish
        'publish.title'      => 'Publish a plugin',
        'publish.hero_html'  => 'Point to the repository and that’s it — the store reads the name, icon, languages and version from your <code>manifest.json</code>. Every new release becomes an automatic update.',
        'publish.opt'        => 'optional',
        'publish.s1.title'   => 'Have the plugin in Ulanzi’s format',
        'publish.s1.lead_html'=> 'Structure from the <a href="https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK" target="_blank" rel="noopener">official SDK</a> — a folder ending in <code>.ulanziPlugin</code>:',
        'publish.s2.title'   => 'Publish a Release on GitHub',
        'publish.s2.lead_html'=> 'The asset must be the zipped folder, with the <strong>same name</strong>:',
        'publish.s2.hint_html'=> '💡 The <a href="%s" target="_blank" rel="noopener">store template</a> ships a GitHub Action that zips and creates the release on every <code>git tag</code>.',
        'publish.s3.title'   => 'Make the storefront shine',
        'publish.s3.lead_html'=> 'A <code>store.json</code> at the repo root adds a cover and screenshots. Without it, the store uses the manifest description.',
        'publish.s3.hint'    => 'Cover in 16:9 (e.g. 1600×900). Paths are relative to the repo root.',
        'publish.s4.title'   => 'Open a PR on the registry',
        'publish.s4.lead_html'=> 'Create <strong>one file</strong> with just your repo and open the Pull Request:',
        'publish.s4.hint_html'=> 'File name = <code>owner__repo.json</code> (replace <code>/</code> with <code>__</code>). Once merged, your plugin shows up in the store. ✨',
        'publish.cta'        => 'Open the registry on GitHub',
        'publish.devmode_html'=> 'Want to test before submitting? Turn on <strong>developer mode</strong> in the Helper and install straight from your repo.',
    ],
    'pt' => [
        'tagline'            => 'Loja não-oficial de plugins para Ulanzi Deck e Dial',
        'nav.publish'        => 'Publicar',
        'hero.title'         => 'Plugins para %s e %s',
        'hero.deck'          => 'Ulanzi Deck',
        'hero.dial'          => 'Dial',
        'hero.sub'           => 'Instalação e updates com um clique. Submissão ágil para devs — é só apontar o repositório.',
        'search.placeholder' => 'Buscar plugins…',
        'filter.all'         => 'Todos',
        'card.by'            => 'por %s',
        'card.langs'         => '%d idiomas',
        'badge.update'       => 'update',
        'btn.install'        => 'Instalar',
        'btn.update_action'  => 'Atualizar',
        'btn.installed'      => 'Instalado ✓',
        'js.installing'      => 'Instalando…',
        'js.searching'       => 'Procurando o Helper…',
        'js.done'            => 'pronto — reinicie o Ulanzi Studio se necessário',
        'js.installed_v'     => 'instalado v%s',
        'js.blocked'         => 'bloqueado: repo fora do registry',
        'js.error'           => 'erro %s',
        'js.retry_not_found' => 'Ainda não achei. Confira se o comando terminou com sucesso.',
        'js.copied'          => 'Copiado ✓',
        'js.copy_manual'     => 'Copie manual',
        'empty.no_plugins'   => 'Nenhum plugin no catálogo ainda. %s',
        'empty.be_first'     => 'Seja o primeiro a publicar.',
        'empty.no_results'   => 'Nenhum plugin encontrado. Tente outra busca.',
        'plugin.about'       => 'Sobre',
        'plugin.whats_new'   => 'Novidades — %s',
        'plugin.details'     => 'Detalhes',
        'plugin.version'     => 'Versão',
        'plugin.min_sw'      => 'UlanziDeck mínimo',
        'plugin.languages'   => 'Idiomas',
        'plugin.published'   => 'Publicado',
        'plugin.source'      => 'Código-fonte',
        'plugin.update_avail'=> 'update disponível',
        'plugin.not_found'   => 'Plugin não encontrado. %s',
        'plugin.back'        => 'Voltar ao catálogo.',
        'footer.auto'        => 'Catálogo atualizado automaticamente a partir das releases do GitHub.',
        'disclaimer'         => 'Projeto independente e não-oficial. Não é afiliado, endossado ou mantido pela Ulanzi. “Ulanzi”, “UlanziDeck” e “Ulanzi Dial” são marcas de seus respectivos donos.',
        'modal.title'        => 'Ative o Helper para instalar',
        'modal.lead_html'    => 'O navegador não pode instalar plugins sozinho. Rode este comando <strong>uma vez só</strong> para ativar o Helper — depois é tudo por aqui, com um clique.',
        'modal.step1'        => 'Copie o comando:',
        'modal.step2_html'   => 'Abra o <strong>Terminal</strong> (aperte <kbd>⌘</kbd>+<kbd>Espaço</kbd>, digite <em>Terminal</em> e Enter).',
        'modal.step3_html'   => 'Cole (<kbd>⌘</kbd>+<kbd>V</kbd>) e aperte <strong>Enter</strong>. Espere a mensagem de sucesso.',
        'modal.step4_html'   => 'Volte aqui e clique em <strong>Instalar</strong> de novo.',
        'modal.copy'         => 'Copiar',
        'modal.retry'        => 'Já instalei — tentar de novo',
        'publish.title'      => 'Publicar um plugin',
        'publish.hero_html'  => 'Aponte o repositório e pronto — a loja lê nome, ícone, idiomas e versão do seu <code>manifest.json</code>. Toda release nova vira update automático.',
        'publish.opt'        => 'opcional',
        'publish.s1.title'   => 'Tenha o plugin no padrão da Ulanzi',
        'publish.s1.lead_html'=> 'Estrutura do <a href="https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK" target="_blank" rel="noopener">SDK oficial</a> — uma pasta terminada em <code>.ulanziPlugin</code>:',
        'publish.s2.title'   => 'Publique uma Release no GitHub',
        'publish.s2.lead_html'=> 'O asset precisa ser a pasta zipada, com o <strong>mesmo nome</strong>:',
        'publish.s2.hint_html'=> '💡 O <a href="%s" target="_blank" rel="noopener">template da loja</a> já traz uma GitHub Action que zipa e cria a release a cada <code>git tag</code>.',
        'publish.s3.title'   => 'Deixe bonito na vitrine',
        'publish.s3.lead_html'=> 'Um <code>store.json</code> na raiz do repo adiciona capa e screenshots. Sem ele, a loja usa a descrição do manifest.',
        'publish.s3.hint'    => 'Capa em 16:9 (ex. 1600×900). Caminhos relativos à raiz do repo.',
        'publish.s4.title'   => 'Abra um PR no registry',
        'publish.s4.lead_html'=> 'Crie <strong>um arquivo</strong> com só o seu repo e abra o Pull Request:',
        'publish.s4.hint_html'=> 'Nome do arquivo = <code>owner__repo.json</code> (troque <code>/</code> por <code>__</code>). Ao mesclar, seu plugin aparece na loja. ✨',
        'publish.cta'        => 'Abrir o registry no GitHub',
        'publish.devmode_html'=> 'Quer testar antes de submeter? Ligue o <strong>modo desenvolvedor</strong> no Helper e instale direto do seu repo.',
    ],
    'zh' => [
        'tagline'            => 'Ulanzi Deck 与 Dial 的非官方插件商店',
        'nav.publish'        => '发布',
        'hero.title'         => '%s 和 %s 插件',
        'hero.deck'          => 'Ulanzi Deck',
        'hero.dial'          => 'Dial',
        'hero.sub'           => '一键安装与更新。开发者发布很快 — 只需指向仓库即可。',
        'search.placeholder' => '搜索插件…',
        'filter.all'         => '全部',
        'card.by'            => '作者 %s',
        'card.langs'         => '%d 种语言',
        'badge.update'       => '更新',
        'btn.install'        => '安装',
        'btn.update_action'  => '更新',
        'btn.installed'      => '已安装 ✓',
        'js.installing'      => '正在安装…',
        'js.searching'       => '正在查找 Helper…',
        'js.done'            => '完成 — 如有需要请重启 Ulanzi Studio',
        'js.installed_v'     => '已安装 v%s',
        'js.blocked'         => '已阻止：仓库不在 registry 中',
        'js.error'           => '错误 %s',
        'js.retry_not_found' => '仍未找到。请确认命令已成功执行。',
        'js.copied'          => '已复制 ✓',
        'js.copy_manual'     => '请手动复制',
        'empty.no_plugins'   => '目录中还没有插件。%s',
        'empty.be_first'     => '成为第一个发布的人。',
        'empty.no_results'   => '未找到插件。请尝试其他搜索。',
        'plugin.about'       => '关于',
        'plugin.whats_new'   => '更新内容 — %s',
        'plugin.details'     => '详情',
        'plugin.version'     => '版本',
        'plugin.min_sw'      => '最低 UlanziDeck 版本',
        'plugin.languages'   => '语言',
        'plugin.published'   => '发布于',
        'plugin.source'      => '源代码',
        'plugin.update_avail'=> '有可用更新',
        'plugin.not_found'   => '未找到插件。%s',
        'plugin.back'        => '返回目录。',
        'footer.auto'        => '目录根据 GitHub 发布自动更新。',
        'disclaimer'         => '独立的非官方项目。与 Ulanzi 无关联，未获其认可或维护。“Ulanzi”“UlanziDeck”和“Ulanzi Dial”是其各自所有者的商标。',
        'modal.title'        => '激活 Helper 以安装',
        'modal.lead_html'    => '浏览器无法自行安装插件。运行此命令<strong>仅一次</strong>即可激活 Helper — 之后就都在这里，一键完成。',
        'modal.step1'        => '复制命令：',
        'modal.step2_html'   => '打开<strong>终端</strong>（按 <kbd>⌘</kbd>+<kbd>空格</kbd>，输入 <em>Terminal</em> 回车）。',
        'modal.step3_html'   => '粘贴（<kbd>⌘</kbd>+<kbd>V</kbd>）并按 <strong>回车</strong>。等待成功提示。',
        'modal.step4_html'   => '回到这里，再次点击<strong>安装</strong>。',
        'modal.copy'         => '复制',
        'modal.retry'        => '我已安装 — 重试',
        'publish.title'      => '发布插件',
        'publish.hero_html'  => '指向仓库即可 — 商店会从你的 <code>manifest.json</code> 读取名称、图标、语言和版本。每个新发布都会自动成为更新。',
        'publish.opt'        => '可选',
        'publish.s1.title'   => '让插件符合 Ulanzi 的格式',
        'publish.s1.lead_html'=> '采用<a href="https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK" target="_blank" rel="noopener">官方 SDK</a> 的结构 — 一个以 <code>.ulanziPlugin</code> 结尾的文件夹：',
        'publish.s2.title'   => '在 GitHub 发布 Release',
        'publish.s2.lead_html'=> '附件必须是打包的文件夹，且<strong>同名</strong>：',
        'publish.s2.hint_html'=> '💡 <a href="%s" target="_blank" rel="noopener">商店模板</a>自带一个 GitHub Action，每次 <code>git tag</code> 都会打包并创建 release。',
        'publish.s3.title'   => '让商店页面更出彩',
        'publish.s3.lead_html'=> '在仓库根目录放一个 <code>store.json</code> 可添加封面和截图。没有它时，商店会使用 manifest 的描述。',
        'publish.s3.hint'    => '封面 16:9（例如 1600×900）。路径相对于仓库根目录。',
        'publish.s4.title'   => '在 registry 提交 PR',
        'publish.s4.lead_html'=> '创建<strong>一个文件</strong>，只写你的仓库，然后提交 Pull Request：',
        'publish.s4.hint_html'=> '文件名 = <code>owner__repo.json</code>（把 <code>/</code> 换成 <code>__</code>）。合并后，你的插件就会出现在商店里。✨',
        'publish.cta'        => '在 GitHub 打开 registry',
        'publish.devmode_html'=> '想在提交前测试？在 Helper 中打开<strong>开发者模式</strong>，直接从你的仓库安装。',
    ],
];

function current_lang(): string {
    static $lang = null;
    if ($lang !== null) return $lang;

    if (isset($_GET['lang']) && in_array($_GET['lang'], LANGS, true)) {
        $lang = $_GET['lang'];
        setcookie('lang', $lang, time() + 31536000, '/');
        return $lang;
    }
    if (isset($_COOKIE['lang']) && in_array($_COOKIE['lang'], LANGS, true)) {
        return $lang = $_COOKIE['lang'];
    }
    $accept = strtolower($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '');
    if (str_starts_with($accept, 'pt')) return $lang = 'pt';
    if (str_starts_with($accept, 'zh')) return $lang = 'zh';
    return $lang = 'en';
}

// t($key, ...$args): tradução (com sprintf se houver args). Fallback: en, depois a própria key.
function t(string $key, ...$args): string {
    $lang = current_lang();
    $s = I18N[$lang][$key] ?? I18N['en'][$key] ?? $key;
    return $args ? vsprintf($s, $args) : $s;
}

// URL da página atual trocando só o parâmetro lang (preserva ?id= etc).
function lang_url(string $lang): string {
    $path = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
    $q = $_GET;
    $q['lang'] = $lang;
    return $path . '?' . http_build_query($q);
}

// Texto localizado de um plugin (name/description/longDescription) com fallback.
// longDescription cai para a descrição localizada e, por fim, para o topo do catálogo.
function loc_text(array $p, string $field): string {
    $locales = LANG_PLUGIN_LOCALES[current_lang()] ?? ['en'];
    $i18n = $p['i18n'] ?? [];
    $fields = $field === 'longDescription' ? ['longDescription', 'description'] : [$field];
    foreach ($locales as $loc) {
        foreach ($fields as $f) {
            if (!empty($i18n[$loc][$f])) return $i18n[$loc][$f];
        }
    }
    foreach ($fields as $f) {
        if (!empty($p[$f])) return $p[$f];
    }
    return '';
}
