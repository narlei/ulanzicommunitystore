<?php
// Configuração da loja. Sem segredos aqui — é tudo público e estático.

const STORE_NAME    = 'UlanziDeck Store';
const STORE_TAGLINE = 'Loja não-oficial de plugins para Ulanzi Deck e Dial';

// Repositório do registry (onde os devs abrem PR pra publicar).
const REGISTRY_REPO_URL = 'https://github.com/narlei/ulanzipluginstore';

// URL crua do install.sh do helper (bootstrap one-liner).
const HELPER_INSTALL_SH = 'https://raw.githubusercontent.com/narlei/ulanzipluginstore/main/helper/install.sh';

// Faixa de portas onde o helper local pode estar escutando (127.0.0.1).
// O JS varre essa faixa até achar quem responde /ping.
const HELPER_PORT_BASE  = 39273;
const HELPER_PORT_COUNT = 5;

// Disclaimer de marca — mantém a loja claramente não-oficial.
const DISCLAIMER = 'Projeto independente e não-oficial. Não é afiliado, endossado ou mantido pela Ulanzi. "Ulanzi", "UlanziDeck" e "Ulanzi Dial" são marcas de seus respectivos donos.';
