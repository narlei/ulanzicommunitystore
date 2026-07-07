# Registry — como submeter um plugin

Esta pasta é a **fonte da verdade** da loja. Cada arquivo `plugins/<owner>__<repo>.json`
representa um plugin publicado. Para submeter o seu:

1. Faça um fork deste repositório.
2. Crie `plugins/<owner>__<repo>.json` com o mínimo:

   ```json
   { "repo": "seu-usuario/seu-repo" }
   ```

   O nome do arquivo deve ser o `owner` e o `repo` separados por `__` (dois underscores),
   trocando qualquer `/` por `__`. Ex.: `narlei/ulanzideck_ticktick` →
   `narlei__ulanzideck_ticktick.json`.

3. Abra um Pull Request. Ao ser aprovado e mesclado, uma GitHub Action lê o `manifest.json`,
   o `store.json` (opcional) e a **release mais nova** do seu repo, e publica o plugin na loja
   automaticamente. Toda nova release vira um update detectado pela loja.

## O que o seu repo precisa ter

- Uma pasta `com.<voce>.<plugin>.ulanziPlugin/` com `manifest.json` (padrão do
  [SDK oficial da Ulanzi](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK)).
- Uma **GitHub Release** cujo asset seja `com.<voce>.<plugin>.ulanziPlugin.zip`
  (o zip da pasta do plugin na raiz). O template da loja já traz uma Action que faz isso.
- Opcional: um `store.json` na raiz do repo com capa, screenshots, descrição longa, tipos de
  device e tags. Sem ele, a loja faz fallback para a `Description` do manifest.

### `store.json` (opcional)

```json
{
  "cover": "resources/cover.png",
  "screenshots": ["resources/banner1.png", "resources/banner2.png"],
  "longDescription": "Descrição mais longa em Markdown ou texto.",
  "deviceTypes": ["deck", "dial"],
  "tags": ["productivity", "timer"]
}
```

Caminhos de imagem são relativos à raiz do seu repo.
