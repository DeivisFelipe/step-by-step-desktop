---
titulo: Conheça o Step-by-Step Code
---

# Boas-vindas

## O que é o Step-by-Step

Uma aula é uma lista de **passos**. Aperte **F8** para avançar e **Shift+F8** para voltar.

> Nota: estas notas só aparecem para quem apresenta (aba Passos e visão do apresentador). A legenda acima aparece para a turma.

```slide transicao="fade"
# Conheça o Step-by-Step Code

- Cada **passo** faz algo na frente da turma
- **F8** avança · **Shift+F8** volta e desfaz
- Tudo aparece também no **palco**: OBS, projetor e celular
```

## Slides em HTML

Slides também podem ser páginas HTML, com o design e as animações que você quiser.

> Nota: abra a aba Apresentação e copie o link do palco para ver como a turma enxerga.

```slide formato="html" transicao="zoom"
<style>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 36px;
    background: radial-gradient(circle at 30% 20%, #6366f1, #0f172a 70%);
  }
  h1 {
    margin: 0;
    font-size: 110px;
    animation: subir 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .bolhas {
    display: flex;
    gap: 40px;
  }
  .bolhas span {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: #f472b6;
    animation: pular 1.4s ease-in-out infinite;
  }
  .bolhas span:nth-child(2) {
    background: #38bdf8;
    animation-delay: 0.2s;
  }
  .bolhas span:nth-child(3) {
    background: #4ade80;
    animation-delay: 0.4s;
  }
  p {
    margin: 0;
    font-size: 44px;
    opacity: 0.85;
  }
  @keyframes subir {
    from {
      opacity: 0;
      transform: translateY(80px);
    }
  }
  @keyframes pular {
    50% {
      transform: translateY(-50px);
    }
  }
</style>
<h1>Slides com animação</h1>
<div class="bolhas"><span></span><span></span><span></span></div>
<p>Feito com HTML e CSS, dentro do passo</p>
```

## Digitar código

O código é **digitado** no editor, como se fosse ao vivo.

```text arquivo="mensagem.txt" operacao="criar"
Olá, turma!
Este arquivo foi digitado pelo Step-by-Step.
Esc pula a animação.
```

## Destacar linhas

```destacar arquivo="mensagem.txt" linhas="2-2"
O destaque escurece o resto do arquivo e mostra esta nota.
```

## Comando no terminal

Os comandos também são digitados, agora no terminal.

```terminal
cat mensagem.txt
```

## Escolha um caminho

A aula pode ter **caminhos**: o professor escolhe na hora (clique, teclas 1 e 2 ou pelo celular).

```escolha titulo="O que você quer ver agora?" variavel="tour"
Laboratório ao vivo -> Laboratório
Desafio com cronômetro -> Desafio
```

# Caminhos

## Laboratório

Código e terminal juntos. Mude o texto, aperte **▶ Rodar** (ou Ctrl+Enter) e depois **F8**.

```laboratorio arquivo="mensagem.txt" layout="lado-a-lado"
cat mensagem.txt
```

```irpara
Fim do tour
```

## Desafio

```desafio tempo="1"
## Desafio relâmpago

Mude o texto de **mensagem.txt** e rode `cat mensagem.txt` no terminal.
```

## Fim do tour

```slide transicao="slide-up"
# Pronto!

- Crie sua aula: **Passos → +**
- Veja as outras **aulas de exemplo** na tela inicial
- **Resetar** (aba Passos) devolve esta pasta ao começo
```
