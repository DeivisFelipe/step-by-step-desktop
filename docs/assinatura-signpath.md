# Assinatura de código gratuita (SignPath Foundation)

A [SignPath Foundation](https://signpath.org/) assina de graça projetos open source. Com o
instalador assinado, o Windows deixa de mostrar “Editor desconhecido”. O aviso do SmartScreen
some aos poucos, conforme o programa ganha reputação (downloads).

## O que já está pronto no projeto

| Exigência da SignPath                                 | Onde está                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Licença open source (OSI) em tudo                     | [`LICENSE`](../LICENSE) (MIT); as 134 bibliotecas incluídas no app usam MIT, ISC, Apache-2.0, BSD e similares              |
| Seção “Code signing policy” com a frase de atribuição | [README](../README.md#code-signing-policy) e notas de cada release ([`build/release-notes.md`](../build/release-notes.md)) |
| Papéis da equipe (autores, revisores, aprovadores)    | README, seção Code signing policy                                                                                          |
| Política de privacidade                               | [`PRIVACY.md`](../PRIVACY.md)                                                                                              |
| Build verificável a partir do código                  | [GitHub Actions](../.github/workflows/release.yml) gera cada release a partir da tag                                       |
| Já ter versões publicadas e funcionalidades descritas | [Releases](https://github.com/DeivisFelipe/step-by-step-desktop/releases) e README                                         |
| Desinstalação                                         | O instalador registra o desinstalador no Windows                                                                           |
| Nome e versão do produto iguais em todos os binários  | electron-builder grava “Step-by-Step Code” e a versão do `package.json`                                                    |

## O que você precisa fazer

1. **Ative a verificação em duas etapas (2FA) no GitHub**: Settings → Password and authentication.
   É obrigatória para todos da equipe.
2. **Envie o pedido** em [signpath.org/apply](https://signpath.org/apply). Respostas sugeridas
   (em inglês) estão abaixo.
3. Aguarde a aprovação. A SignPath cria uma organização e um projeto para você em
   [app.signpath.io](https://app.signpath.io) e combina como as assinaturas serão pedidas.
4. Depois de aprovado, me passe:
   - o **Organization ID** e o **slug** do projeto e da política de assinatura;
   - um **token de API** do SignPath, que você cadastra no GitHub em
     Settings → Secrets and variables → Actions → New repository secret, com o nome
     `SIGNPATH_API_TOKEN` (o token não deve ser colado em conversas nem em arquivos).

   Com isso eu ajusto o workflow para enviar o app e o instalador para assinatura antes de
   publicar o release. Cada release vai esperar a sua aprovação no site do SignPath.

## Respostas sugeridas para o formulário

- **Project name:** Step-by-Step Code
- **Repository:** https://github.com/DeivisFelipe/step-by-step-desktop
- **Homepage / download page:** https://github.com/DeivisFelipe/step-by-step-desktop/releases
- **License:** MIT
- **Description:** Desktop app (Electron) for teachers to prepare programming lessons in advance
  and present them step by step: animated typing of code into files, terminal commands,
  slides, line highlights and timed challenges, plus browser sources for OBS Studio and a
  live page for students. Free and open source, Portuguese-speaking audience (Brazil).
- **Artifacts to sign:** the Windows application executable (`step-by-step-code.exe`) and the
  NSIS installer (`step-by-step-code-x.y.z-setup.exe`), built by GitHub Actions on each version
  tag.
- **Build system:** GitHub Actions (`.github/workflows/release.yml`), electron-builder.
- **Team:** Deivis Felipe (author, reviewer and approver).
- **Privacy:** no telemetry; the app only contacts GitHub to check for and download updates
  (see PRIVACY.md).
