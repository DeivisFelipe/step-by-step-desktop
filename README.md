# 📚 Step-by-Step Code — Desktop

Aplicativo desktop (Electron + React + TypeScript) para **preparar aulas de programação com antecedência e apresentá-las passo a passo**: cada passo digita código, roda comandos, mostra slides, destaca linhas ou propõe desafios, na frente da turma, no projetor ou numa transmissão pelo OBS.

É a versão desktop da extensão [Step-by-Step-Code para VS Code](https://github.com/DeivisFelipe/step-by-step-code).

## 💾 Instalação

Baixe o `step-by-step-code-x.y.z-setup.exe` da [página de releases](https://github.com/DeivisFelipe/step-by-step-desktop/releases/latest) e execute. O app é instalado para o seu usuário (sem pedir administrador) e cria um atalho na área de trabalho.

> Como o instalador não é assinado digitalmente, o Windows pode mostrar “O Windows protegeu o computador”. Clique em **Mais informações → Executar assim mesmo**.

**Atualizações**: o app verifica sozinho se há versão nova no GitHub, baixa em segundo plano e mostra **Reiniciar para atualizar** na barra de status. A versão nova é instalada por cima da antiga, que é removida. Se preferir, a atualização é instalada na próxima vez que o app for fechado. Também dá para verificar manualmente em **Configurações → Versão**.

**Seus arquivos são mantidos** ao atualizar ou desinstalar:

- as aulas ficam dentro de cada projeto, na pasta `.stepbystep/`;
- as configurações (estilos, OBS, servidor) e a lista de pastas recentes ficam em `%APPDATA%\step-by-step-code`.

## ✨ Funcionalidades

### Preparar a aula

- **Passos organizados em fluxos**. Cada passo é uma **sequência de ações** executadas em ordem:
  - **Código em arquivo**: criar, acrescentar ao final, inserir no início, inserir depois de um texto, substituir um texto, inserir no cursor, sobrescrever ou excluir. Animação de **digitação** (com velocidade ajustável e pausas naturais), de **transformação suave** (magic move) ou nenhuma.
  - **Comando no terminal**: digita (e opcionalmente executa) o comando, em um terminal com nome. Um nome novo cria outro terminal, útil para deixar um servidor rodando.
  - **Esperar o terminal**: segura a aula até aparecer um texto (ex.: `ready in`) ou `/regex/`.
  - **Slide**: Markdown e imagem, ou **HTML** com estilos, scripts e animações próprios (pensado para 1920×1080). Transições entre slides (esmaecer, deslizar, zoom, desfoque, girar 3D, cortina) e opção de tela cheia.
  - **Destacar linhas**: escurece o resto do arquivo e mostra uma explicação num balão.
  - **Desafio**: enunciado com cronômetro.
  - **Preview**: mostra uma página (URL ou arquivo do projeto).
  - **Cena do OBS**: troca a cena da transmissão.
  - **Laboratório**: código e terminal juntos no palco (lado a lado, empilhados ou em abas); o professor edita o código ao vivo e roda com ▶ (`Ctrl+Enter`) quantas vezes quiser.
- **Aulas com caminhos**: **menu de escolha** (o professor escolhe por botão, teclas 1–9, celular ou por um botão dentro de um slide HTML com `proximoPasso(n)`), **se / senão** (saída do terminal, arquivo existe ou contém, variável) e **ir para**. Tudo editável também no diagrama do fluxo.
- **Legenda** (pública, aparece para a turma) e **notas do apresentador** (privadas) em cada passo.
- **Variáveis** `[[Nome:valor]]` no conteúdo, ajustáveis antes de executar.
- **Diagrama do fluxo**: arraste os passos para mudar a ordem e ligue as opções de menu e condições aos passos de destino.
- **Ensaio da aula**: roda tudo sem animação numa cópia e aponta o que falharia (arquivos que não existem, textos não encontrados, linhas fora do arquivo, imagens faltando). Também pode executar os comandos numa pasta temporária.
- **Criar passos a partir do git**: cada commit escolhido vira um passo.
- **Aula em Markdown**: importe e exporte a aula num formato de texto fácil de escrever e revisar ([formato](docs/formato-aula.md)).

### Durante a aula

- **Avançar** (`F8` ou `PageDown`), **Voltar** (`Shift+F8` ou `PageUp`), que desfaz as alterações do passo nos arquivos, **Ir até este passo** e **Resetar**, que devolve o projeto exatamente ao estado de antes do primeiro passo.
- Funciona com **passador de slides** (PageDown/PageUp).
- O progresso fica salvo: fechar e abrir o app não perde em que passo a aula estava.
- **Modo projetor** (tudo maior), **caneta** (`F6`) e **holofote** (`F7`).
- **Visão do apresentador** numa janela separada ou **no celular** (QR code): notas, próximo passo, cronômetros e botões de avançar/voltar.
- **Página para os alunos** na rede local (QR code): acompanham o código ao vivo e podem copiá-lo.

### Transmissão e gravação (OBS)

- Servidor local com páginas para usar como **fonte de navegador** no OBS:

  | Página       | Conteúdo                                                       |
  | ------------ | -------------------------------------------------------------- |
  | `/palco`     | Troca sozinho entre código, terminal, slide, desafio e preview |
  | `/codigo`    | Só a janela de código                                          |
  | `/terminal`  | Só o terminal                                                  |
  | `/slide`     | Slides e desafios                                              |
  | `/legenda`   | Legenda do passo, fundo transparente                           |
  | `/progresso` | Barra com o passo atual, fundo transparente                    |

  As URLs completas ficam na aba **Apresentação** do app (padrão `http://127.0.0.1:4545`).

- Código no estilo **Carbon/ray.so**: janela macOS/Windows, temas do Shiki, fundo em gradiente ou transparente, proporção 16:9, 4:3, 1:1 ou **9:16 (vertical)**, fonte, sombra, cantos e legenda configuráveis. Use `?estilo=Nome` na URL para ter fontes com estilos diferentes.
- Integração com o **obs-websocket** (OBS 28+): troca de cena conforme o tipo de passo e **capítulos na gravação** (OBS 30.2+). O app também gera a lista de **capítulos para o YouTube**.
- **Apostila para os alunos** em PDF ou Markdown, e **repositório git com um commit por passo**.

A aula fica salva em `.stepbystep/lesson.json` dentro da pasta do projeto, e pode ser versionada junto com ele. O progresso (`sessao.json`) e o ponto de partida (`inicio/`) ficam na mesma pasta e já são ignorados pelo git.

## ⌨️ Atalhos

| Atalho                | Ação                                           |
| --------------------- | ---------------------------------------------- |
| `F8` / `PageDown`     | Executar o próximo passo                       |
| `Shift+F8` / `PageUp` | Voltar o último passo                          |
| `Esc`                 | Pular a animação ou a espera; tirar o destaque |
| `F6` / `F7`           | Caneta / holofote                              |
| `Ctrl+S`              | Salvar arquivo                                 |
| `Ctrl+O`              | Abrir pasta                                    |
| `Ctrl+W`              | Fechar aba                                     |
| `Ctrl+B`              | Mostrar/ocultar a barra lateral                |
| `Ctrl+J`              | Mostrar/ocultar o terminal                     |
| `Ctrl+roda`           | Zoom no editor                                 |

## 🛠️ Desenvolvimento

```bash
npm install
```

```bash
npm run dev
```

Verificações:

```bash
npm run typecheck
```

```bash
npm run lint
```

### Gerar instalador

```bash
npm run build:win
```

O instalador fica em `dist/`. Também há `build:mac` e `build:linux`.

> Se o build no Windows falhar com `Cannot create symbolic link` ao extrair o `winCodeSign`,
> ative o **Modo de Desenvolvedor** do Windows (Configurações → Sistema → Para desenvolvedores)
> ou rode o terminal como administrador. O pacote traz links simbólicos de macOS que o Windows
> só deixa criar nesses casos.

### Publicar uma nova versão

O workflow [`release.yml`](.github/workflows/release.yml) gera o instalador e publica o release no GitHub sempre que uma tag de versão é enviada. Para lançar uma versão nova:

```bash
npm version patch
```

```bash
git push --follow-tags
```

`npm version patch` sobe a versão (1.0.0 → 1.0.1), faz o commit e cria a tag `v1.0.1`. Use `minor` ou `major` para mudanças maiores. Em alguns minutos o release aparece no GitHub e os apps instalados se atualizam sozinhos.

## 📁 Estrutura

```
src/
  main/             processo principal: arquivos, terminal (node-pty), servidor de
                    apresentação, cliente do OBS, ensaio, git e PDF
  preload/          ponte segura entre o processo principal e a interface
  shared/           tipos usados pelos dois lados (estilos, palco, IPC)
  renderer/
    src/            a IDE: componentes, motor de execução, estados (zustand)
    overlay/        páginas de apresentação (OBS, alunos, visão do apresentador)
    common/         componentes usados pelos dois (Markdown, slide, desafio)
docs/               formato da aula em Markdown
```

## 🔒 Privacidade

O app não coleta nem envia dados pessoais ou de uso. Ele só acessa o GitHub para verificar e baixar atualizações. Detalhes na [política de privacidade](PRIVACY.md).

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/). _(Application pending: the installers published so far are not signed yet.)_

- **Committers and reviewers:** [Deivis Felipe (@DeivisFelipe)](https://github.com/DeivisFelipe)
- **Approvers:** [Deivis Felipe (@DeivisFelipe)](https://github.com/DeivisFelipe)

Every release is built from this repository by [GitHub Actions](.github/workflows/release.yml), and each signing request is approved manually.

**Privacy:** this program will not transfer any information to other networked systems unless specifically requested by the user, except for checking GitHub for updates. See the [privacy policy](PRIVACY.md).

## 📜 Licença

[MIT](LICENSE). Todas as bibliotecas incluídas no app também usam licenças open source (MIT, ISC, Apache-2.0, BSD e similares).
