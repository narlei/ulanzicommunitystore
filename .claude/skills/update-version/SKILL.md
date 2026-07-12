---
name: update-version
description: Faz o bump de versão da Ulanzi Community Store e recria o release_notes.md a partir do diff acumulado, para o CI publicar como corpo da GitHub Release. Use quando o usuário disser "sobe a versão", "bump de versão", "fecha a release" ou "update-version".
---

Esta skill prepara o repositório para uma nova release: decide o tipo de bump com o usuário, atualiza `VERSION` e reescreve `release_notes.md` (que o workflow `.github/workflows/release-app.yml` usa como `body_path` da GitHub Release quando `VERSION` é empurrado para `main`).

## Passos

1. **Descubra a base do diff.**
   - Tente `git describe --tags --abbrev=0` para achar a última tag `vX.Y.Z`.
   - Se não houver tags, use o commit anterior à última mudança em `VERSION`: `git log --format=%H -- VERSION`, pegando a segunda linha (a primeira é a mudança atual). Se `VERSION` só mudou uma vez (ou nunca), use a raiz do histórico disponível.
   - Rode `git log <base>..HEAD --oneline` e `git diff <base>..HEAD --stat` para mapear o que mudou. Se as mensagens de commit forem genéricas (ex.: "Improvements"), **leia o diff real** (`git diff <base>..HEAD`) para entender o que de fato mudou — não confie só nas mensagens.

2. **Pergunte ao usuário o tipo de bump** com a AskUserQuestion, oferecendo `patch`, `minor` e `major`. Recomende uma opção com base no diff (breaking changes / remoção de API pública → major; novas features aditivas → minor; correções → patch), mas deixe o usuário decidir.

3. **Calcule a nova versão** a partir do `VERSION` atual (formato `X.Y.Z`):
   - `major`: `(X+1).0.0`
   - `minor`: `X.(Y+1).0`
   - `patch`: `X.Y.(Z+1)`

4. **Escreva o novo valor em `VERSION`** (sem quebra de linha extra, mesmo formato do arquivo atual).

5. **Recrie `release_notes.md` do zero** (não faça append), **sempre em inglês** — independente do idioma usado na conversa com o usuário, já que isso vai pro corpo público da GitHub Release. Estrutura:
   - Título com a nova versão e data (`## vX.Y.Z — YYYY-MM-DD`).
   - Seções curtas agrupando as mudanças reais encontradas no diff (ex.: `### Added`, `### Fixed`, `### Changed`), com bullets objetivos em inglês, sem jargão de commit.
   - Nada de placeholder — cada bullet deve refletir algo que você realmente viu no diff.

6. **Rode `npm run sync:version`** para propagar a versão para `package.json` e `apps/store-desktop/package.json`.

7. **Não commite nem faça push automaticamente.** Mostre um resumo do que mudou (`VERSION`, `release_notes.md`, os `package.json`) e deixe o usuário revisar e commitar. Lembre que o push de `VERSION` para `main` é o gatilho do `release-app.yml`.
