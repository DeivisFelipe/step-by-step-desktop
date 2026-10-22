---
titulo: Escolha sua trilha (aula com caminhos)
---

# Começo

## Escolha a linguagem

A turma escolhe: **JavaScript** ou **Python**?

> Nota: clique num botão do slide, aperte 1 ou 2, ou use a visão do apresentador no celular. Cada trilha tem seus passos e as duas terminam juntas. Abra a aba de diagrama do fluxo para ver os caminhos.

```slide formato="html" transicao="zoom"
<style>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 60px;
    background: linear-gradient(135deg, #111827, #312e81);
  }
  h1 {
    margin: 0;
    font-size: 96px;
  }
  .opcoes {
    display: flex;
    gap: 60px;
  }
  button {
    width: 520px;
    padding: 50px;
    border: 0;
    border-radius: 36px;
    font-size: 64px;
    font-weight: 700;
    color: #111827;
    cursor: pointer;
    transition: transform 200ms;
  }
  button:hover {
    transform: scale(1.06);
  }
  .js {
    background: #facc15;
  }
  .py {
    background: #60a5fa;
  }
</style>
<h1>Qual trilha vamos seguir?</h1>
<div class="opcoes">
  <button class="js" onclick="proximoPasso(0)">JavaScript</button>
  <button class="py" onclick="proximoPasso(1)">Python</button>
</div>
```

```escolha titulo="Qual trilha?" variavel="trilha" palco="nao"
JavaScript -> JS: olá
Python -> Python: olá
```

# Trilha JavaScript

## JS: olá

> Nota: precisa do Node.js.

```js arquivo="trilha.js" operacao="criar"
const nomes = ['Ana', 'Bruno', 'Carla']

for (const nome of nomes) {
  console.log(`Olá, ${nome}!`)
}
```

```terminal
node trilha.js
```

## JS: laboratório

Peça nomes para a turma, coloque na lista e rode com ▶.

```laboratorio arquivo="trilha.js" layout="lado-a-lado"
node trilha.js
```

```irpara
Comparar as trilhas
```

# Trilha Python

## Python: olá

> Nota: no Linux troque a variável python por python3.

```python arquivo="trilha.py" operacao="criar"
nomes = ["Ana", "Bruno", "Carla"]

for nome in nomes:
    print(f"Olá, {nome}!")
```

```terminal
[[python:python]] trilha.py
```

## Python: laboratório

Peça nomes para a turma, coloque na lista e rode com ▶.

```laboratorio arquivo="trilha.py" layout="lado-a-lado"
[[python:python]] trilha.py
```

# Final

## Comparar as trilhas

O **se / senão** lembra qual trilha foi escolhida e mostra o slide certo.

```se
variavel trilha = "JavaScript" -> Final JavaScript
senao -> Final Python
```

## Final JavaScript

```slide transicao="slide-left"
# Trilha JavaScript ✔

- `const` e listas com `[]`
- `for...of` para repetir
- Textos com crase: `` `Olá, ${nome}!` ``
```

```irpara
Encerramento
```

## Final Python

```slide transicao="slide-left"
# Trilha Python ✔

- Listas com `[]`
- `for nome in nomes:` e indentação
- Textos com f-string: `f"Olá, {nome}!"`
```

## Encerramento

```slide transicao="blur"
# Uma aula, vários caminhos

- **Menu de escolha**: a turma decide
- **Ir para**: as trilhas se encontram
- **Se / senão**: a aula lembra o que foi escolhido
```
