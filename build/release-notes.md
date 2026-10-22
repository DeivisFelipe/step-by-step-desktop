**Step-by-Step Code** — prepare aulas de programação e apresente o código passo a passo: digitação animada, comandos no terminal, slides, destaques, desafios e páginas para o OBS. Veja todas as funcionalidades no [README](https://github.com/DeivisFelipe/step-by-step-desktop#readme).

### Novidades da 2.1

- **Versão para Linux**: AppImage (qualquer distribuição, atualiza sozinho) e pacote `.deb` (Ubuntu, Debian, Mint).
- **8 aulas de exemplo** já vêm com o app, na tela inicial: tour do Step-by-Step, HTML e CSS, JavaScript com Node.js, Python do zero, Introdução ao PHP, Git básico, Escolha sua trilha (aula com caminhos) e Galeria de slides em HTML. Ao abrir, uma cópia vai para `Documentos/Step-by-Step Code/Exemplos`.
- Com um menu esperando, as teclas 1–9 escolhem a opção mesmo com o cursor no editor de código.
- Abrir outro projeto com um passo esperando (menu, laboratório) cancela esse passo em vez de travar.

### Novidades da 2.0

**Aulas com caminhos**

- **Menu de escolha**: o passo mostra opções (no app, no palco e na visão do apresentador) e o professor escolhe por clique, teclas 1–9 ou pelo celular; o passo escolhido roda em seguida.
- **Se / senão**: escolhe o próximo passo pela saída do terminal, por um arquivo que existe ou contém um texto, ou pela opção escolhida num menu.
- **Ir para**: termina um caminho e volta ao principal (ou repete passos).
- **No diagrama do fluxo**: cada opção e condição tem sua bolinha; puxe até o passo de destino. Clique direito cria menus e condições.

**Laboratório (código + terminal)**

- Código e terminal juntos no palco, lado a lado, empilhados ou em abas. O professor edita o código ao vivo e roda com ▶ (`Ctrl+Enter`) quantas vezes quiser; `F8` continua e voltar desfaz as edições.

**Slides**

- **Slides em HTML**, com estilos, scripts e animações próprios. Botões no slide podem escolher o caminho (`proximoPasso(n)`) ou rodar um comando no terminal (`rodarComando('…')`).
- **Transições** entre slides: esmaecer, deslizar, zoom, desfoque, girar 3D e cortina.
- **Tela cheia**: o slide ocupa 100% da largura e da altura da página, sem fundo.
- Slides longos diminuem a fonte até caber, sem cortar.

**Palco e terminal**

- O terminal do palco não mistura mais as linhas e fica legível (largura do terminal ajustável em Configurações).
- Tamanhos de fonte separados para código, terminal e slides.
- Passos com código e depois um comando esperam `F8` antes de rodar o comando, para dar tempo de explicar o código.
- Código no palco aceita rolagem e seleção.
- `Shift+F8` cancela um passo que está esperando (menu, laboratório ou comando) e desfaz o que ele fez.

**Correções**

- Arrastar passos no diagrama não pisca mais e a nova ordem fica ao soltar.
- O progresso conta cada passo uma vez (rodar de novo não passa de 100%).
- Logo da tela inicial maior.

### Instalação

- **Windows**: baixe **`step-by-step-code-*-setup.exe`** e execute.
- **Linux (qualquer distribuição)**: baixe o **`.AppImage`**, rode `chmod +x step-by-step-code-*.AppImage` e abra. No Ubuntu 22.04+, se não abrir: `sudo apt install libfuse2`.
- **Ubuntu, Debian, Mint**: baixe o **`.deb`** e instale com `sudo apt install ./step-by-step-code_*_amd64.deb`.

Quem já tem o app instalado (Windows ou AppImage) recebe esta versão automaticamente: aparece **Reiniciar para atualizar** na barra de status.

Os arquivos `latest*.yml` e `.blockmap` são usados pelas atualizações automáticas; não é preciso baixá-los.

### Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/) — pending approval; see the [code signing policy](https://github.com/DeivisFelipe/step-by-step-desktop#code-signing-policy).

Privacy: this program will not transfer any information to other networked systems unless specifically requested by the user, except for checking GitHub for updates. See the [privacy policy](https://github.com/DeivisFelipe/step-by-step-desktop/blob/master/PRIVACY.md).
