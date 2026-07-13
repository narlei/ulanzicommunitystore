/* global window, document, localStorage, navigator */
(function (global) {
  'use strict';

  var LANGS = ['en', 'pt', 'zh'];
  var LANG_NAMES = { en: 'EN', pt: 'PT', zh: '中文' };
  var LANG_HTML = { en: 'en', pt: 'pt-BR', zh: 'zh-CN' };
  var STORAGE_KEY = 'marketing-lang';

  var strings = {
    en: {
      // Meta
      meta_title: 'Ulanzi Community Store — the open-source community store for Ulanzi Deck & Dial',
      meta_description: 'The open-source community store for Ulanzi Deck & Dial plugins. Publish in minutes, install in one click, update automatically — a free companion to the official Ulanzi Studio Marketplace, for macOS and Windows.',
      meta_og_description: 'The open-source community store for Ulanzi Deck & Dial plugins — publish in minutes, install in one click, update automatically. macOS and Windows.',

      // Nav
      nav_community: 'Community',
      nav_features: 'Features',
      nav_plugins: 'Plugins',
      nav_how: 'How it works',
      nav_starter: 'Create a plugin',
      nav_publish: 'Publish',
      nav_github: 'GitHub',
      nav_download: 'Download',
      lang_label: 'Language',

      // Hero
      hero_badge: 'By the community · Open source · Free',
      hero_title_1: 'The community store for',
      hero_title_2: 'Ulanzi Deck & Dial plugins.',
      hero_lead: 'Install and update community plugins in one click — or publish your own with a single Pull Request.',
      hero_download: 'Download for free',
      hero_publish: 'Publish a plugin',
      hero_no_account: 'No account needed',
      window_search: 'Search plugins…',
      window_installed: '✓ Installed',
      window_installing: 'Installing…',
      window_install: 'Install',
      window_ticktick_desc: 'Pomodoro control on a smart button · v1.0.1',
      window_aicost_desc: 'Track AI coding spend locally · v1.0.3',
      window_claude_desc: 'Live subscription limits · v1.0.6',

      // Stats
      stat_1_label: 'install & update',
      stat_2_label: 'open source',
      stat_3_value: 'minutes',
      stat_3_label: 'from PR to published plugin',
      stat_4_label: 'accounts, trackers or ads',

      // Community
      community_eyebrow: 'Why a community store?',
      community_title: 'A companion to the official marketplace.<br>Not a competitor.',
      community_1_title: 'Made by fans of Ulanzi gear',
      community_1_body: 'This project exists because we love the hardware and want more people building for it. Every plugin here is one more reason to plug in a Deck or Dial.',
      community_2_title: 'The fast lane for makers',
      community_2_body: 'The official Ulanzi Studio Marketplace has a careful review process. The Community Store is where you ship today, iterate with users, and push updates the moment you cut a release.',
      community_3_title: 'Owned by the community',
      community_3_body: 'Open registry, open pipeline, open app — all MIT-licensed on GitHub. No accounts, no lock-in: publish here <em>and</em> on the official marketplace. It\'s your plugin.',

      // Features
      features_eyebrow: 'Why you\'ll love it',
      features_title: 'Install it. Update it.<br>Trust it.',
      feature_1_title: 'One-click installs',
      feature_1_body: 'The app grabs the latest release and drops it straight into your Ulanzi plugins folder. No unzipping, no path juggling.',
      feature_2_title: 'Updates that find you',
      feature_2_body: 'See at a glance when an installed plugin has a new version and update it with a single click.',
      feature_3_title: 'Community registry',
      feature_3_body: 'Every plugin comes from the reviewed community registry, generated automatically from GitHub releases and manifests.',
      feature_4_title: 'macOS & Windows',
      feature_4_body: 'Native desktop builds for both platforms, published automatically through GitHub Releases.',
      feature_5_title: 'Safe by default',
      feature_5_body: 'ZIP extraction validates plugin IDs and entry paths before anything is written to disk. Only catalog plugins install by default.',
      feature_6_title: 'Open source',
      feature_6_body: 'The app, the registry, and the catalog pipeline are all public on GitHub. Audit it, fork it, contribute to it.',

      // Plugins
      plugins_eyebrow: 'Community plugins',
      plugins_title: 'A growing set of plugins,<br>built in the open.',
      plugin_ticktick_desc: 'Start, pause, and mirror your TickTick focus/pomodoro sessions from a single smart button, with live remaining time on your deck.',
      plugin_aicost_desc: 'Track spend on Claude, Codex, Cursor, Gemini, Copilot and more, right on your deck. Data is read locally — no API keys needed.',
      plugin_claude_desc: 'Monitor your 5-hour and weekly Claude Code limits in real time, with color-coded thresholds and a reset countdown.',
      plugin_view_source: 'View source',
      plugin_browse: 'Browse all community plugins',
      chip_productivity: 'Productivity',
      chip_devtools: 'Dev tools',

      // Catalog page
      catalog_meta_title: 'Community plugins — Ulanzi Community Store',
      catalog_meta_description: 'Browse every community plugin in the Ulanzi Community Store registry. Download the free desktop app to install and update them in one click.',
      catalog_eyebrow: 'Community registry',
      catalog_title: 'All community plugins',
      catalog_lead: 'Explore every approved plugin from the live catalog. Install and update them in one click with the free desktop app.',
      catalog_banner_title: 'Install happens in the app',
      catalog_banner_body: 'Browsing here is free. To install a plugin on your Ulanzi Deck or Dial, download the Community Store app.',
      catalog_search: 'Search plugins…',
      catalog_sort_recent: 'Recent',
      catalog_sort_popular: 'Popular',
      catalog_all: 'All',
      catalog_count: '%s plugins',
      catalog_loading: 'Loading catalog…',
      catalog_error: 'Could not load the catalog. Check your connection and try again.',
      catalog_retry: 'Try again',
      catalog_no_results: 'No plugins match your search.',
      catalog_get_app: 'Download the app',
      catalog_source: 'Source',
      catalog_about: 'About',
      catalog_details: 'Details',
      catalog_version: 'Version',
      catalog_downloads: 'Downloads',
      catalog_downloads_n: '%s downloads',
      catalog_devices: 'Devices',
      catalog_platforms: 'Platforms',
      catalog_published: 'Published',
      catalog_tags: 'Tags',
      catalog_install_hint: 'Download the free Ulanzi Community Store app to install this plugin on your Deck or Dial in one click.',

      // How it works
      how_eyebrow: 'How it works',
      how_title: 'Download, browse,<br>install.',
      how_1_title: 'Download the app',
      how_1_body: 'Grab the latest release for macOS or Windows straight from GitHub. Free, no account required.',
      how_2_title: 'Browse the catalog',
      how_2_body: 'See every approved plugin with its description, version, screenshots, and source repository.',
      how_3_title: 'Click install',
      how_3_body: 'The plugin lands in your Ulanzi plugins folder, ready to drag onto a key. Updates are one click too.',

      // Starter kit
      starter_eyebrow: 'For developers',
      starter_title: 'Scaffold a new plugin<br>with one command.',
      starter_1_title: 'Install Node.js',
      starter_1_body: 'The CLI tool requires Node.js. Install it via Terminal on macOS:',
      starter_1_win: 'For Windows or Linux, download the installer directly from <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">nodejs.org</a>.',
      starter_2_title: 'Run the scaffolding tool',
      starter_2_body: 'Open your Terminal in an empty folder (or an existing plugin repository) and run the command below. It will ask you a few questions and instantly generate a complete plugin structure, including a <code>Makefile</code> for local testing, a GitHub Actions pipeline, and a built-in AI skill to make vibe-coding a breeze.',
      starter_docs: 'Read the full documentation',
      copy: 'Copy',
      copied: 'Copied!',

      // Publish
      publish_eyebrow: 'For developers',
      publish_title: 'Publish your plugin<br>in three steps.',
      publish_1_title: 'Build your plugin',
      publish_1_body: 'Create it with the <a href="https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK" target="_blank" rel="noopener noreferrer">official Ulanzi SDK</a>: a <code>com.you.plugin.ulanziPlugin/</code> folder containing a <code>manifest.json</code>.',
      publish_2_title: 'Publish a GitHub Release',
      publish_2_body: 'Zip the plugin folder and attach it to a release as <code>com.you.plugin.ulanziPlugin.zip</code>. Every new release becomes an update in the store.',
      publish_3_title: 'Submit your repository',
      publish_3_body: 'Paste your repo URL below — or in the app\'s <strong>Send plugin</strong> tab. We validate it and open the Pull Request for you.',
      publish_tool_title: 'Check your repo & generate the submission',
      publish_tool_sub: 'Runs entirely in your browser against the public GitHub API. Nothing is uploaded anywhere.',
      publish_placeholder: 'https://github.com/you/your-plugin',
      publish_input_aria: 'Your plugin\'s GitHub repository URL',
      publish_validate: 'Validate',
      publish_checking: 'Checking…',
      publish_pr: 'Open the Pull Request on GitHub',
      publish_copy_json: 'Copy JSON',
      publish_hint: 'GitHub forks the store repository and creates the file for you — just confirm with “Propose changes”. Once the PR is merged, your plugin goes live automatically.',
      publish_doc: 'Want a cover image, screenshots and tags? Add a <code>store.json</code> to your repo — see the <a href="https://github.com/narlei/ulanzicommunitystore/tree/main/registry" target="_blank" rel="noopener noreferrer">full submission guide</a>.',
      publish_error_url: 'Enter a GitHub repository URL like https://github.com/you/your-plugin (or just you/your-plugin).',
      publish_error_network: 'Could not reach GitHub. Check your connection (or API rate limit) and try again.',
      publish_repo_ok: 'Repository found: %s',
      publish_repo_fail: 'Repository not found. Use a public GitHub URL like https://github.com/you/your-plugin.',
      publish_release_ok: 'Latest release: %s',
      publish_release_fail: 'No GitHub Release found. Publish a release before submitting.',
      publish_asset_ok: 'Release asset: %s',
      publish_asset_fail: 'The latest release has no *.ulanziPlugin.zip asset. Zip the plugin folder and attach it to the release.',
      publish_manifest_ok: 'manifest.json is valid: %s',
      publish_manifest_warn: 'manifest.json found in %s/ but Name or Version is missing.',
      publish_manifest_fail: 'manifest.json missing or invalid in %s/.',
      publish_store_ok: 'store.json found — cover, screenshots and tags will show in the store.',
      publish_store_warn: 'No store.json (optional). Add one for cover image, screenshots and tags.',
      publish_store_warn_invalid: 'store.json exists but is not valid JSON, so it will be ignored.',

      // CTA + footer
      cta_title: 'All community plugins in a single app.',
      cta_sub: 'Free, open source, and ready in seconds.',
      cta_download: 'Download the latest release',
      about_html: '<strong>Independent project.</strong> The Ulanzi Community Store is an unofficial project made by fans of Ulanzi hardware. It is not affiliated with, endorsed by, or maintained by Ulanzi. For officially reviewed plugins, use the Ulanzi Studio Marketplace — the two stores complement each other.',
      footer_releases: 'Releases',
      footer_publish: 'Publish a plugin',
      footer_issue: 'Report an issue',
      footer_copy: 'Ulanzi Community Store — made with 💚 by the community, for the community. Unofficial project, not affiliated with Ulanzi.',

      // Download modal
      modal_close: 'Close',
      modal_title: 'Download Ulanzi Community Store',
      modal_sub: '<span class="modal-trust">🔓 100% open source · MIT licensed</span> — inspect every line, including the script below, on <a href="https://github.com/narlei/ulanzicommunitystore" target="_blank" rel="noopener noreferrer">GitHub</a> before you run anything.',
      modal_recommended: 'Recommended',
      modal_os_macos: 'macOS',
      modal_os_windows: 'Windows',
      modal_terminal_title: 'Install via Terminal',
      modal_terminal_body: 'On macOS, files fetched with <code>curl</code> aren\'t quarantined the way browser downloads are, so Gatekeeper never blocks the app.',
      modal_view_script: 'View install.sh source →',
      modal_powershell_title: 'Install via PowerShell',
      modal_powershell_body: 'Native Windows path — no bash required. Downloads the latest <code>.exe</code> and launches the installer.',
      modal_view_ps1: 'View install.ps1 source →',
      modal_or: 'or download directly',
      modal_all_releases: 'All releases →',
      modal_note: 'The <code>.dmg</code> triggers a normal macOS "unidentified developer" warning on first launch, since the app isn\'t Apple-notarized (no paid developer account). That\'s expected — see the <a href="https://github.com/narlei/ulanzicommunitystore#-releases" target="_blank" rel="noopener noreferrer">README</a> for how to open it, or use the Terminal install above instead.',
      modal_note_windows: 'Run the downloaded <code>.exe</code> and complete the installer wizard. Prefer the PowerShell one-liner above if you want a one-step setup.',
      modal_select_text: 'Select the text',
    },

    pt: {
      meta_title: 'Ulanzi Community Store — a loja open source da comunidade para Ulanzi Deck & Dial',
      meta_description: 'A loja open source da comunidade para plugins de Ulanzi Deck & Dial. Publique em minutos, instale com um clique, atualize automaticamente — um complemento gratuito ao Ulanzi Studio Marketplace oficial, para macOS e Windows.',
      meta_og_description: 'A loja open source da comunidade para plugins de Ulanzi Deck & Dial — publique em minutos, instale com um clique, atualize automaticamente. macOS e Windows.',

      nav_community: 'Comunidade',
      nav_features: 'Recursos',
      nav_plugins: 'Plugins',
      nav_how: 'Como funciona',
      nav_starter: 'Criar um plugin',
      nav_publish: 'Publicar',
      nav_github: 'GitHub',
      nav_download: 'Baixar',
      lang_label: 'Idioma',

      hero_badge: 'Pela comunidade · Open source · Grátis',
      hero_title_1: 'A loja da comunidade para',
      hero_title_2: 'plugins de Ulanzi Deck & Dial.',
      hero_lead: 'Instale e atualize plugins da comunidade com um clique — ou publique o seu com um único Pull Request.',
      hero_download: 'Baixar grátis',
      hero_publish: 'Publicar um plugin',
      hero_no_account: 'Sem conta necessária',
      window_search: 'Buscar plugins…',
      window_installed: '✓ Instalado',
      window_installing: 'Instalando…',
      window_install: 'Instalar',
      window_ticktick_desc: 'Controle de pomodoro em um botão inteligente · v1.0.1',
      window_aicost_desc: 'Acompanhe gastos com IA localmente · v1.0.3',
      window_claude_desc: 'Limites de assinatura ao vivo · v1.0.6',

      stat_1_label: 'instalar e atualizar',
      stat_2_label: 'open source',
      stat_3_value: 'minutos',
      stat_3_label: 'do PR ao plugin publicado',
      stat_4_label: 'contas, rastreadores ou anúncios',

      community_eyebrow: 'Por que uma loja da comunidade?',
      community_title: 'Um complemento ao marketplace oficial.<br>Não um concorrente.',
      community_1_title: 'Feito por fãs do hardware Ulanzi',
      community_1_body: 'Este projeto existe porque amamos o hardware e queremos mais pessoas criando para ele. Cada plugin aqui é mais um motivo para conectar um Deck ou Dial.',
      community_2_title: 'A via rápida para makers',
      community_2_body: 'O Ulanzi Studio Marketplace oficial tem um processo de revisão cuidadoso. A Community Store é onde você publica hoje, itera com usuários e envia atualizações no momento em que corta um release.',
      community_3_title: 'Da comunidade, para a comunidade',
      community_3_body: 'Registry aberto, pipeline aberta, app aberto — tudo com licença MIT no GitHub. Sem contas, sem lock-in: publique aqui <em>e</em> no marketplace oficial. O plugin é seu.',

      features_eyebrow: 'Por que você vai gostar',
      features_title: 'Instale. Atualize.<br>Confie.',
      feature_1_title: 'Instalação em um clique',
      feature_1_body: 'O app baixa o release mais recente e coloca direto na pasta de plugins da Ulanzi. Sem descompactar, sem caçar caminhos.',
      feature_2_title: 'Atualizações que te encontram',
      feature_2_body: 'Veja de relance quando um plugin instalado tem uma nova versão e atualize com um único clique.',
      feature_3_title: 'Registry da comunidade',
      feature_3_body: 'Todo plugin vem do registry revisado da comunidade, gerado automaticamente a partir de releases e manifests do GitHub.',
      feature_4_title: 'macOS e Windows',
      feature_4_body: 'Builds nativos para as duas plataformas, publicados automaticamente via GitHub Releases.',
      feature_5_title: 'Seguro por padrão',
      feature_5_body: 'A extração do ZIP valida IDs de plugin e caminhos de entrada antes de gravar no disco. Por padrão, só plugins do catálogo são instalados.',
      feature_6_title: 'Open source',
      feature_6_body: 'O app, o registry e o pipeline de catálogo são públicos no GitHub. Audite, faça fork e contribua.',

      plugins_eyebrow: 'Plugins da comunidade',
      plugins_title: 'Um conjunto crescente de plugins,<br>construídos em aberto.',
      plugin_ticktick_desc: 'Inicie, pause e espelhe sessões de foco/pomodoro do TickTick em um único botão inteligente, com tempo restante ao vivo no deck.',
      plugin_aicost_desc: 'Acompanhe gastos com Claude, Codex, Cursor, Gemini, Copilot e mais, direto no deck. Dados lidos localmente — sem chaves de API.',
      plugin_claude_desc: 'Monitore seus limites de 5 horas e semanais do Claude Code em tempo real, com limiares por cor e contagem regressiva de reset.',
      plugin_view_source: 'Ver código',
      plugin_browse: 'Ver todos os plugins da comunidade',
      chip_productivity: 'Produtividade',
      chip_devtools: 'Ferramentas',

      catalog_meta_title: 'Plugins da comunidade — Ulanzi Community Store',
      catalog_meta_description: 'Explore todos os plugins da comunidade no registry da Ulanzi Community Store. Baixe o app grátis para instalar e atualizar com um clique.',
      catalog_eyebrow: 'Registry da comunidade',
      catalog_title: 'Todos os plugins da comunidade',
      catalog_lead: 'Explore cada plugin aprovado do catálogo ao vivo. Instale e atualize com um clique no app desktop grátis.',
      catalog_banner_title: 'A instalação acontece no app',
      catalog_banner_body: 'Navegar aqui é grátis. Para instalar um plugin no seu Ulanzi Deck ou Dial, baixe o app Community Store.',
      catalog_search: 'Buscar plugins…',
      catalog_sort_recent: 'Recentes',
      catalog_sort_popular: 'Populares',
      catalog_all: 'Todos',
      catalog_count: '%s plugins',
      catalog_loading: 'Carregando catálogo…',
      catalog_error: 'Não foi possível carregar o catálogo. Verifique a conexão e tente de novo.',
      catalog_retry: 'Tentar de novo',
      catalog_no_results: 'Nenhum plugin corresponde à busca.',
      catalog_get_app: 'Baixar o app',
      catalog_source: 'Código',
      catalog_about: 'Sobre',
      catalog_details: 'Detalhes',
      catalog_version: 'Versão',
      catalog_downloads: 'Downloads',
      catalog_downloads_n: '%s downloads',
      catalog_devices: 'Dispositivos',
      catalog_platforms: 'Plataformas',
      catalog_published: 'Publicado',
      catalog_tags: 'Tags',
      catalog_install_hint: 'Baixe o app grátis Ulanzi Community Store para instalar este plugin no Deck ou Dial com um clique.',

      how_eyebrow: 'Como funciona',
      how_title: 'Baixe, explore,<br>instale.',
      how_1_title: 'Baixe o app',
      how_1_body: 'Pegue o release mais recente para macOS ou Windows direto do GitHub. Grátis, sem conta.',
      how_2_title: 'Explore o catálogo',
      how_2_body: 'Veja cada plugin aprovado com descrição, versão, capturas de tela e repositório de origem.',
      how_3_title: 'Clique em instalar',
      how_3_body: 'O plugin vai para a pasta de plugins da Ulanzi, pronto para arrastar para uma tecla. Atualizações também são com um clique.',

      starter_eyebrow: 'Para desenvolvedores',
      starter_title: 'Crie um novo plugin<br>com um comando.',
      starter_1_title: 'Instale o Node.js',
      starter_1_body: 'A ferramenta CLI exige Node.js. No macOS, instale pelo Terminal:',
      starter_1_win: 'No Windows ou Linux, baixe o instalador em <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">nodejs.org</a>.',
      starter_2_title: 'Rode a ferramenta de scaffold',
      starter_2_body: 'Abra o Terminal em uma pasta vazia (ou em um repositório de plugin existente) e rode o comando abaixo. Ele fará algumas perguntas e gerará na hora a estrutura completa do plugin, incluindo um <code>Makefile</code> para testes locais, um pipeline do GitHub Actions e uma skill de IA para facilitar o vibe-coding.',
      starter_docs: 'Ler a documentação completa',
      copy: 'Copiar',
      copied: 'Copiado!',

      publish_eyebrow: 'Para desenvolvedores',
      publish_title: 'Publique seu plugin<br>em três passos.',
      publish_1_title: 'Crie seu plugin',
      publish_1_body: 'Use o <a href="https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK" target="_blank" rel="noopener noreferrer">SDK oficial da Ulanzi</a>: uma pasta <code>com.voce.plugin.ulanziPlugin/</code> com um <code>manifest.json</code>.',
      publish_2_title: 'Publique um GitHub Release',
      publish_2_body: 'Compacte a pasta do plugin e anexe à release como <code>com.voce.plugin.ulanziPlugin.zip</code>. Cada novo release vira uma atualização na loja.',
      publish_3_title: 'Envie seu repositório',
      publish_3_body: 'Cole a URL do repo abaixo — ou na aba <strong>Enviar plugin</strong> do app. Validamos e abrimos o Pull Request para você.',
      publish_tool_title: 'Verifique o repo e gere o envio',
      publish_tool_sub: 'Roda inteiramente no navegador contra a API pública do GitHub. Nada é enviado para lugar nenhum.',
      publish_placeholder: 'https://github.com/voce/seu-plugin',
      publish_input_aria: 'URL do repositório GitHub do seu plugin',
      publish_validate: 'Validar',
      publish_checking: 'Verificando…',
      publish_pr: 'Abrir o Pull Request no GitHub',
      publish_copy_json: 'Copiar JSON',
      publish_hint: 'O GitHub faz o fork do repositório da loja e cria o arquivo para você — só confirme com “Propose changes”. Quando o PR for mesclado, seu plugin entra no ar automaticamente.',
      publish_doc: 'Quer capa, capturas e tags? Adicione um <code>store.json</code> ao repo — veja o <a href="https://github.com/narlei/ulanzicommunitystore/tree/main/registry" target="_blank" rel="noopener noreferrer">guia completo de envio</a>.',
      publish_error_url: 'Informe uma URL de repositório GitHub como https://github.com/voce/seu-plugin (ou só voce/seu-plugin).',
      publish_error_network: 'Não foi possível acessar o GitHub. Verifique a conexão (ou o limite da API) e tente de novo.',
      publish_repo_ok: 'Repositório encontrado: %s',
      publish_repo_fail: 'Repositório não encontrado. Use uma URL pública do GitHub, ex.: https://github.com/voce/seu-plugin.',
      publish_release_ok: 'Release mais recente: %s',
      publish_release_fail: 'Nenhuma GitHub Release encontrada. Publique uma release antes de enviar.',
      publish_asset_ok: 'Asset da release: %s',
      publish_asset_fail: 'A release mais recente não tem um asset *.ulanziPlugin.zip. Compacte a pasta do plugin e anexe à release.',
      publish_manifest_ok: 'manifest.json válido: %s',
      publish_manifest_warn: 'manifest.json encontrado em %s/ mas falta Name ou Version.',
      publish_manifest_fail: 'manifest.json ausente ou inválido em %s/.',
      publish_store_ok: 'store.json encontrado — capa, capturas e tags aparecerão na loja.',
      publish_store_warn: 'Sem store.json (opcional). Adicione um para capa, capturas e tags.',
      publish_store_warn_invalid: 'store.json existe mas não é um JSON válido, então será ignorado.',

      cta_title: 'Todos os plugins da comunidade em um só app.',
      cta_sub: 'Grátis, open source e pronto em segundos.',
      cta_download: 'Baixar o release mais recente',
      about_html: '<strong>Projeto independente.</strong> A Ulanzi Community Store é um projeto não oficial feito por fãs do hardware Ulanzi. Não é afiliada, endossada ou mantida pela Ulanzi. Para plugins com revisão oficial, use o Ulanzi Studio Marketplace — as duas lojas se complementam.',
      footer_releases: 'Releases',
      footer_publish: 'Publicar um plugin',
      footer_issue: 'Reportar um problema',
      footer_copy: 'Ulanzi Community Store — feita com 💚 pela comunidade, para a comunidade. Projeto não oficial, sem afiliação com a Ulanzi.',

      modal_close: 'Fechar',
      modal_title: 'Baixar Ulanzi Community Store',
      modal_sub: '<span class="modal-trust">🔓 100% open source · licença MIT</span> — inspecione cada linha, inclusive o script abaixo, no <a href="https://github.com/narlei/ulanzicommunitystore" target="_blank" rel="noopener noreferrer">GitHub</a> antes de rodar qualquer coisa.',
      modal_recommended: 'Recomendado',
      modal_os_macos: 'macOS',
      modal_os_windows: 'Windows',
      modal_terminal_title: 'Instalar via Terminal',
      modal_terminal_body: 'No macOS, arquivos baixados com <code>curl</code> não entram em quarentena como downloads do navegador, então o Gatekeeper não bloqueia o app.',
      modal_view_script: 'Ver o código do install.sh →',
      modal_powershell_title: 'Instalar via PowerShell',
      modal_powershell_body: 'Caminho nativo no Windows — sem bash. Baixa o <code>.exe</code> mais recente e abre o instalador.',
      modal_view_ps1: 'Ver o código do install.ps1 →',
      modal_or: 'ou baixe diretamente',
      modal_all_releases: 'Todos os releases →',
      modal_note: 'O <code>.dmg</code> aciona o aviso normal do macOS de "desenvolvedor não identificado" na primeira abertura, porque o app não é notarizado pela Apple (sem conta de desenvolvedor paga). Isso é esperado — veja o <a href="https://github.com/narlei/ulanzicommunitystore#-releases" target="_blank" rel="noopener noreferrer">README</a> para abrir, ou use a instalação via Terminal acima.',
      modal_note_windows: 'Execute o <code>.exe</code> baixado e complete o assistente de instalação. Prefira o one-liner do PowerShell acima se quiser configurar em um passo.',
      modal_select_text: 'Selecione o texto',
    },

    zh: {
      meta_title: 'Ulanzi Community Store — Ulanzi Deck 与 Dial 的开源社区商店',
      meta_description: 'Ulanzi Deck 与 Dial 插件的开源社区商店。几分钟内发布，一键安装，自动更新——作为官方 Ulanzi Studio Marketplace 的免费补充，支持 macOS 与 Windows。',
      meta_og_description: 'Ulanzi Deck 与 Dial 插件的开源社区商店——几分钟内发布，一键安装，自动更新。支持 macOS 与 Windows。',

      nav_community: '社区',
      nav_features: '功能',
      nav_plugins: '插件',
      nav_how: '使用方法',
      nav_starter: '创建插件',
      nav_publish: '发布',
      nav_github: 'GitHub',
      nav_download: '下载',
      lang_label: '语言',

      hero_badge: '社区驱动 · 开源 · 免费',
      hero_title_1: '面向',
      hero_title_2: 'Ulanzi Deck 与 Dial 插件的社区商店。',
      hero_lead: '一键安装与更新社区插件——或通过一个 Pull Request 发布你自己的插件。',
      hero_download: '免费下载',
      hero_publish: '发布插件',
      hero_no_account: '无需账号',
      window_search: '搜索插件…',
      window_installed: '✓ 已安装',
      window_installing: '正在安装…',
      window_install: '安装',
      window_ticktick_desc: '智能按键上的番茄钟控制 · v1.0.1',
      window_aicost_desc: '本地追踪 AI 编程花费 · v1.0.3',
      window_claude_desc: '实时订阅额度 · v1.0.6',

      stat_1_label: '安装与更新',
      stat_2_label: '开源',
      stat_3_value: '数分钟',
      stat_3_label: '从 PR 到插件上线',
      stat_4_label: '账号、追踪器或广告',

      community_eyebrow: '为什么需要社区商店？',
      community_title: '官方市场的补充，<br>而非竞争者。',
      community_1_title: '由 Ulanzi 硬件爱好者打造',
      community_1_body: '这个项目存在，是因为我们热爱这套硬件，并希望更多人为它开发。这里的每一个插件，都是再多一个插上 Deck 或 Dial 的理由。',
      community_2_title: '创作者的快车道',
      community_2_body: '官方 Ulanzi Studio Marketplace 有严谨的审核流程。Community Store 是你今天就能发布、与用户一起迭代、一切 release 立刻推送更新的地方。',
      community_3_title: '由社区拥有',
      community_3_body: '开放的 registry、开放的流水线、开放的应用——全部在 GitHub 上以 MIT 许可发布。无账号、无锁定：可以在这里发布，也<strong>可以</strong>同时发布到官方市场。插件属于你。',

      features_eyebrow: '你会喜欢的原因',
      features_title: '安装。更新。<br>放心使用。',
      feature_1_title: '一键安装',
      feature_1_body: '应用会获取最新 release，并直接放入 Ulanzi 插件文件夹。无需解压，无需折腾路径。',
      feature_2_title: '主动发现更新',
      feature_2_body: '一眼看出已安装插件是否有新版本，一键完成更新。',
      feature_3_title: '社区 registry',
      feature_3_body: '每个插件都来自经过审核的社区 registry，由 GitHub release 与 manifest 自动生成。',
      feature_4_title: 'macOS 与 Windows',
      feature_4_body: '双平台原生桌面构建，通过 GitHub Releases 自动发布。',
      feature_5_title: '默认安全',
      feature_5_body: '解压 ZIP 前会校验插件 ID 与入口路径。默认只安装目录中的插件。',
      feature_6_title: '开源',
      feature_6_body: '应用、registry 与目录流水线全部公开在 GitHub。可审计、可 fork、可贡献。',

      plugins_eyebrow: '社区插件',
      plugins_title: '持续增长的插件集合，<br>在开放中构建。',
      plugin_ticktick_desc: '用一枚智能按键开始、暂停并同步 TickTick 专注/番茄钟会话，实时显示剩余时间。',
      plugin_aicost_desc: '在 deck 上追踪 Claude、Codex、Cursor、Gemini、Copilot 等花费。数据本地读取——无需 API 密钥。',
      plugin_claude_desc: '实时监控 Claude Code 的 5 小时与每周额度，含色阶阈值与重置倒计时。',
      plugin_view_source: '查看源码',
      plugin_browse: '浏览全部社区插件',
      chip_productivity: '效率',
      chip_devtools: '开发工具',

      catalog_meta_title: '社区插件 — Ulanzi Community Store',
      catalog_meta_description: '浏览 Ulanzi Community Store 社区 registry 中的全部插件。下载免费桌面应用即可一键安装与更新。',
      catalog_eyebrow: '社区 registry',
      catalog_title: '全部社区插件',
      catalog_lead: '浏览实时目录中每一个已批准的插件。使用免费桌面应用一键安装与更新。',
      catalog_banner_title: '安装在应用中完成',
      catalog_banner_body: '在此浏览完全免费。要在 Ulanzi Deck 或 Dial 上安装插件，请下载 Community Store 应用。',
      catalog_search: '搜索插件…',
      catalog_sort_recent: '最新',
      catalog_sort_popular: '热门',
      catalog_all: '全部',
      catalog_count: '%s 个插件',
      catalog_loading: '正在加载目录…',
      catalog_error: '无法加载目录。请检查网络后重试。',
      catalog_retry: '重试',
      catalog_no_results: '没有匹配的插件。',
      catalog_get_app: '下载应用',
      catalog_source: '源码',
      catalog_about: '关于',
      catalog_details: '详情',
      catalog_version: '版本',
      catalog_downloads: '下载量',
      catalog_downloads_n: '%s 次下载',
      catalog_devices: '设备',
      catalog_platforms: '平台',
      catalog_published: '发布日期',
      catalog_tags: '标签',
      catalog_install_hint: '下载免费的 Ulanzi Community Store 应用，即可在 Deck 或 Dial 上一键安装此插件。',

      how_eyebrow: '使用方法',
      how_title: '下载、浏览、<br>安装。',
      how_1_title: '下载应用',
      how_1_body: '从 GitHub 直接获取 macOS 或 Windows 最新 release。免费，无需账号。',
      how_2_title: '浏览目录',
      how_2_body: '查看每个已批准插件的描述、版本、截图与源码仓库。',
      how_3_title: '点击安装',
      how_3_body: '插件会进入 Ulanzi 插件文件夹，可直接拖到按键上。更新同样一键完成。',

      starter_eyebrow: '面向开发者',
      starter_title: '一条命令<br>搭建新插件。',
      starter_1_title: '安装 Node.js',
      starter_1_body: 'CLI 工具需要 Node.js。在 macOS 上可通过终端安装：',
      starter_1_win: 'Windows 或 Linux 请直接从 <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">nodejs.org</a> 下载安装包。',
      starter_2_title: '运行脚手架工具',
      starter_2_body: '在空文件夹（或已有插件仓库）中打开终端并运行下方命令。它会询问几个问题，并立即生成完整插件结构，包括用于本地测试的 <code>Makefile</code>、GitHub Actions 流水线，以及让 vibe-coding 更轻松的内置 AI skill。',
      starter_docs: '阅读完整文档',
      copy: '复制',
      copied: '已复制！',

      publish_eyebrow: '面向开发者',
      publish_title: '三步发布<br>你的插件。',
      publish_1_title: '构建插件',
      publish_1_body: '使用<a href="https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK" target="_blank" rel="noopener noreferrer">Ulanzi 官方 SDK</a>创建：包含 <code>manifest.json</code> 的 <code>com.you.plugin.ulanziPlugin/</code> 文件夹。',
      publish_2_title: '发布 GitHub Release',
      publish_2_body: '将插件文件夹打包，并以 <code>com.you.plugin.ulanziPlugin.zip</code> 附加到 release。每个新 release 都会成为商店中的更新。',
      publish_3_title: '提交仓库',
      publish_3_body: '在下方粘贴仓库 URL——或在应用的<strong>提交插件</strong>标签页中操作。我们会验证并为你打开 Pull Request。',
      publish_tool_title: '检查仓库并生成提交',
      publish_tool_sub: '完全在浏览器中对 GitHub 公开 API 运行。不会上传任何内容。',
      publish_placeholder: 'https://github.com/you/your-plugin',
      publish_input_aria: '你的插件 GitHub 仓库 URL',
      publish_validate: '验证',
      publish_checking: '正在检查…',
      publish_pr: '在 GitHub 上打开 Pull Request',
      publish_copy_json: '复制 JSON',
      publish_hint: 'GitHub 会 fork 商店仓库并为你创建文件——只需确认 “Propose changes”。PR 合并后，插件会自动上线。',
      publish_doc: '需要封面图、截图和标签？在仓库中添加 <code>store.json</code>——详见<a href="https://github.com/narlei/ulanzicommunitystore/tree/main/registry" target="_blank" rel="noopener noreferrer">完整提交流程</a>。',
      publish_error_url: '请输入 GitHub 仓库 URL，例如 https://github.com/you/your-plugin（或 you/your-plugin）。',
      publish_error_network: '无法访问 GitHub。请检查网络连接（或 API 速率限制）后重试。',
      publish_repo_ok: '找到仓库：%s',
      publish_repo_fail: '未找到仓库。请使用公开的 GitHub 地址，例如 https://github.com/you/your-plugin。',
      publish_release_ok: '最新 release：%s',
      publish_release_fail: '未找到 GitHub Release。请先发布 release 再提交。',
      publish_asset_ok: 'Release 资源文件：%s',
      publish_asset_fail: '最新 release 中没有 *.ulanziPlugin.zip 资源。请将插件文件夹打包并附加到 release。',
      publish_manifest_ok: 'manifest.json 有效：%s',
      publish_manifest_warn: '在 %s/ 中找到 manifest.json，但缺少 Name 或 Version。',
      publish_manifest_fail: '%s/ 中的 manifest.json 缺失或无效。',
      publish_store_ok: '找到 store.json——封面、截图和标签将在商店中展示。',
      publish_store_warn: '没有 store.json（可选）。添加后可展示封面、截图和标签。',
      publish_store_warn_invalid: 'store.json 存在但不是有效 JSON，将被忽略。',

      cta_title: '所有社区插件，尽在一个应用。',
      cta_sub: '免费、开源，几秒即可上手。',
      cta_download: '下载最新 release',
      about_html: '<strong>独立项目。</strong>Ulanzi Community Store 是由 Ulanzi 硬件爱好者制作的非官方项目。与 Ulanzi 无关联、未获其背书或维护。如需官方审核插件，请使用 Ulanzi Studio Marketplace——两家商店互为补充。',
      footer_releases: 'Releases',
      footer_publish: '发布插件',
      footer_issue: '反馈问题',
      footer_copy: 'Ulanzi Community Store — 社区用 💚 为社区打造。非官方项目，与 Ulanzi 无关联。',

      modal_close: '关闭',
      modal_title: '下载 Ulanzi Community Store',
      modal_sub: '<span class="modal-trust">🔓 100% 开源 · MIT 许可</span> — 在运行任何内容前，请先在 <a href="https://github.com/narlei/ulanzicommunitystore" target="_blank" rel="noopener noreferrer">GitHub</a> 上检查每一行代码，包括下方脚本。',
      modal_recommended: '推荐',
      modal_os_macos: 'macOS',
      modal_os_windows: 'Windows',
      modal_terminal_title: '通过终端安装',
      modal_terminal_body: '在 macOS 上，用 <code>curl</code> 获取的文件不会像浏览器下载那样被隔离，因此 Gatekeeper 不会拦截应用。',
      modal_view_script: '查看 install.sh 源码 →',
      modal_powershell_title: '通过 PowerShell 安装',
      modal_powershell_body: 'Windows 原生方式——无需 bash。下载最新 <code>.exe</code> 并启动安装程序。',
      modal_view_ps1: '查看 install.ps1 源码 →',
      modal_or: '或直接下载',
      modal_all_releases: '全部 releases →',
      modal_note: '<code>.dmg</code> 在首次启动时会触发 macOS 正常的“未识别开发者”警告，因为应用未经 Apple 公证（没有付费开发者账号）。这是预期行为——请参阅 <a href="https://github.com/narlei/ulanzicommunitystore#-releases" target="_blank" rel="noopener noreferrer">README</a> 了解如何打开，或直接使用上方终端安装。',
      modal_note_windows: '运行下载的 <code>.exe</code> 并完成安装向导。若希望一步完成，请优先使用上方 PowerShell 一键命令。',
      modal_select_text: '请选择文本',
    },
  };

  function detectLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGS.indexOf(saved) !== -1) return saved;
    } catch (err) { /* ignore */ }

    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (nav.indexOf('pt') === 0) return 'pt';
    if (nav.indexOf('zh') === 0) return 'zh';
    return 'en';
  }

  function t(lang, key) {
    var args = Array.prototype.slice.call(arguments, 2);
    var value = (strings[lang] && strings[lang][key]) || (strings.en && strings.en[key]) || key;
    for (var i = 0; i < args.length; i++) {
      value = value.replace('%s', String(args[i]));
    }
    return value;
  }

  function setMeta(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function apply(lang) {
    if (LANGS.indexOf(lang) === -1) lang = 'en';

    document.documentElement.lang = LANG_HTML[lang] || lang;

    document.title = t(lang, 'meta_title');
    setMeta('meta[name="description"]', 'content', t(lang, 'meta_description'));
    setMeta('meta[property="og:title"]', 'content', 'Ulanzi Community Store');
    setMeta('meta[property="og:description"]', 'content', t(lang, 'meta_og_description'));
    setMeta('meta[name="twitter:title"]', 'content', 'Ulanzi Community Store');
    setMeta('meta[name="twitter:description"]', 'content', t(lang, 'meta_og_description'));

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      if (!key) continue;
      el.textContent = t(lang, key);
    }

    var htmlNodes = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmlNodes.length; j++) {
      var htmlEl = htmlNodes[j];
      var htmlKey = htmlEl.getAttribute('data-i18n-html');
      if (!htmlKey) continue;
      htmlEl.innerHTML = t(lang, htmlKey);
    }

    var phNodes = document.querySelectorAll('[data-i18n-placeholder]');
    for (var k = 0; k < phNodes.length; k++) {
      var phEl = phNodes[k];
      var phKey = phEl.getAttribute('data-i18n-placeholder');
      if (!phKey) continue;
      phEl.setAttribute('placeholder', t(lang, phKey));
    }

    var ariaNodes = document.querySelectorAll('[data-i18n-aria]');
    for (var m = 0; m < ariaNodes.length; m++) {
      var ariaEl = ariaNodes[m];
      var ariaKey = ariaEl.getAttribute('data-i18n-aria');
      if (!ariaKey) continue;
      ariaEl.setAttribute('aria-label', t(lang, ariaKey));
    }

    // Language switcher active state
    var buttons = document.querySelectorAll('[data-set-lang]');
    for (var n = 0; n < buttons.length; n++) {
      var btn = buttons[n];
      var isActive = btn.getAttribute('data-set-lang') === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) { /* ignore */ }

    global.__marketingLang = lang;
    document.dispatchEvent(new CustomEvent('marketing:langchange', { detail: { lang: lang } }));
  }

  function init() {
    var lang = detectLang();
    apply(lang);

    document.addEventListener('click', function (event) {
      var target = event.target.closest('[data-set-lang]');
      if (!target) return;
      event.preventDefault();
      apply(target.getAttribute('data-set-lang'));
    });
  }

  global.MarketingI18n = {
    LANGS: LANGS,
    LANG_NAMES: LANG_NAMES,
    LANG_HTML: LANG_HTML,
    detectLang: detectLang,
    t: function (key) {
      var lang = global.__marketingLang || detectLang();
      var args = Array.prototype.slice.call(arguments, 1);
      return t.apply(null, [lang, key].concat(args));
    },
    apply: apply,
    init: init,
    getLang: function () {
      return global.__marketingLang || detectLang();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
