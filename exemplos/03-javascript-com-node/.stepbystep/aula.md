---
titulo: JavaScript com Node.js
---

# Primeiros passos

## JavaScript fora do navegador

O **Node.js** roda JavaScript direto no terminal.

> Nota: precisa do Node.js instalado (nodejs.org). Confira com o próximo passo.

```slide transicao="fade"
# JavaScript com Node.js

- A mesma linguagem do navegador
- Roda no **terminal** e em servidores
- `node arquivo.js` executa um arquivo
```

## Conferir a instalação

```terminal
node -v
```

## Olá, mundo

```js arquivo="ola.js" operacao="criar"
console.log('Olá, mundo!')
```

```terminal
node ola.js
```

# Variáveis e funções

## Variáveis

**const** não muda; **let** pode mudar. A crase monta textos com `${}`.

```js arquivo="variaveis.js" operacao="criar"
const nome = 'Ana'
let idade = 20
idade = idade + 1

console.log(`${nome} tem ${idade} anos`)
```

```terminal
node variaveis.js
```

## Listas e repetição

```js arquivo="notas.js" operacao="criar"
const notas = [7.5, 8, 9.5, 6]

let soma = 0
for (const nota of notas) {
  soma = soma + nota
}

console.log('Média:', soma / notas.length)
```

```terminal
node notas.js
```

## Uma função

Uma **função** guarda um cálculo para usar várias vezes.

```js arquivo="notas.js" operacao="acrescentar"

function media(lista) {
  const total = lista.reduce((acc, n) => acc + n, 0)
  return total / lista.length
}

console.log('Média com função:', media(notas))
console.log('Outra turma:', media([10, 5, 8]))
```

```terminal
node notas.js
```

## O que a função faz

```destacar arquivo="notas.js" linhas="10-13"
reduce soma tudo; a função devolve o resultado com return.
```

# Prática

## Laboratório

Mude a lista de notas e rode quantas vezes quiser (▶ ou Ctrl+Enter). **F8** continua.

```laboratorio arquivo="notas.js" layout="empilhado"
node notas.js
```

## Desafio

```desafio tempo="5"
## Sua vez

Crie a função `maiorNota(lista)` e mostre a maior nota com `console.log`.

Dica: `Math.max(...lista)`
```
