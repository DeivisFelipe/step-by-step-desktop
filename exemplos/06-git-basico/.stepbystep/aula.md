---
titulo: Git básico
---

# Primeiro repositório

## Para que serve o Git

O **Git** guarda o histórico do projeto: cada **commit** é uma foto dos arquivos.

> Nota: precisa do Git instalado (git-scm.com). Para repetir a aula do zero, apague a pasta .git depois de Resetar.

```slide transicao="fade"
# Git básico

- **Repositório**: a pasta com o histórico
- **Commit**: uma foto dos arquivos, com mensagem
- **Branch**: uma linha de trabalho paralela
```

## Conferir a instalação

```terminal
git --version
```

## Criar o repositório

```terminal
git init
```

## Um arquivo para versionar

```markdown arquivo="README.md" operacao="criar"
# Meu projeto

Projeto de exemplo para aprender Git.
```

## Ver o estado

O arquivo novo aparece como **não rastreado**.

```terminal
git status
```

## Primeiro commit

`add` escolhe o que entra na foto; `commit` tira a foto.

> Nota: o -c define nome e e-mail só para este comando, para funcionar em qualquer computador.

```terminal
git add README.md
git -c user.name="Professor" -c user.email="professor@exemplo.com" commit -m "Primeiro commit"
```

# Mudanças

## Mudar um arquivo

```markdown arquivo="README.md" operacao="acrescentar"

## Como usar

Abra o arquivo e leia.
```

## O que mudou

`git diff` mostra as linhas novas (+) e removidas (-).

```terminal
git --no-pager diff
```

## Segundo commit

`-a` inclui todos os arquivos já rastreados.

```terminal
git -c user.name="Professor" -c user.email="professor@exemplo.com" commit -am "Explica como usar"
```

## O histórico

```terminal
git --no-pager log --oneline
```

# Branches

## Uma nova linha de trabalho

```terminal
git switch -c nova-ideia
```

```text arquivo="ideias.txt" operacao="criar"
Uma ideia testada sem mexer na linha principal.
```

```terminal
git add ideias.txt
git -c user.name="Professor" -c user.email="professor@exemplo.com" commit -m "Testa uma ideia"
```

## Voltar e juntar

`switch -` volta para a branch anterior; `merge` traz o trabalho da outra branch.

```terminal
git switch -
git merge nova-ideia
git --no-pager log --oneline --graph
```

## Desafio

```desafio tempo="5"
## Sua vez

1. Crie a branch `minha-parte`
2. Crie um arquivo e faça um commit nela
3. Volte e junte com `merge`
```
