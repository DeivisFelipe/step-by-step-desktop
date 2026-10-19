# 📚 Step-by-Step Code — Desktop

Aplicativo desktop (Electron + React + TypeScript) para **preparar aulas de programação com antecedência e apresentá-las passo a passo**. Cada passo digita código em um arquivo ou um comando no terminal, com animação, na frente da turma.

É a versão desktop da extensão [Step-by-Step-Code para VS Code](https://github.com/DeivisFelipe/step-by-step-code).

## ✨ Funcionalidades

- **Explorador de arquivos**: criar, renomear, mover (arrastar e soltar) e excluir arquivos e pastas.
- **Editor de código** (Monaco, o mesmo do VS Code), com abas, indicador de alterações não salvas e `Ctrl+S`.
- **Terminal integrado** (PowerShell, cmd, Git Bash, WSL, bash/zsh) aberto na pasta do projeto.
- **Passos da aula** organizados em fluxos, com dois tipos de ação:
  - **Código em arquivo**: criar, acrescentar ao final, inserir no início, substituir um texto, inserir no cursor ou sobrescrever, com digitação animada e velocidade ajustável.
  - **Comando no terminal**: digita o comando e (opcionalmente) pressiona Enter.
- **Modo apresentação**: _Avançar_ (`F8`), _Voltar_ (`Shift+F8`, desfaz as alterações do passo nos arquivos) e _Resetar_.
- **Variáveis** `[[Nome:valor]]` dentro do conteúdo, editáveis antes de executar o passo.
- **Notas do apresentador**, mostradas quando o passo é o próximo.
- **Diagrama do fluxo**: visualize os passos e ligue um passo a outro para mudar a ordem.

A aula é salva automaticamente em `.stepbystep/lesson.json`, dentro da pasta aberta, e pode ser versionada junto com o projeto.

## ⌨️ Atalhos

| Atalho      | Ação                            |
| ----------- | ------------------------------- |
| `F8`        | Executar o próximo passo        |
| `Shift+F8`  | Voltar o último passo           |
| `Esc`       | Pular a animação de digitação   |
| `Ctrl+S`    | Salvar arquivo                  |
| `Ctrl+O`    | Abrir pasta                     |
| `Ctrl+W`    | Fechar aba                      |
| `Ctrl+B`    | Mostrar/ocultar a barra lateral |
| `Ctrl+J`    | Mostrar/ocultar o terminal      |
| `Ctrl+roda` | Zoom no editor                  |

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

Também há `build:mac` e `build:linux`.

## 📁 Estrutura

```
src/
  main/        processo principal (arquivos, diálogos, terminal com node-pty)
  preload/     ponte segura entre o processo principal e a interface
  renderer/src/
    components/  interface (explorador, editor, passos, diagrama, terminal)
    engine/      execução dos passos (digitação animada e desfazer)
    store/       estado (zustand): arquivos, abas, aula, apresentação
    lib/         utilitários (caminhos, árvore da aula, Monaco)
```

## 📜 Licença

MIT
