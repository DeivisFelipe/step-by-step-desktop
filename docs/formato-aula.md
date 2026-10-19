# Formato da aula em Markdown

Uma aula pode ser escrita (ou exportada) como um arquivo Markdown comum e importada
pela aba **Apresentação → Importar aula (Markdown)**. Use **Exportar aula (Markdown
editável)** para ver qualquer aula existente nesse formato.

## Estrutura

````markdown
---
titulo: Funções em JavaScript
---

# Introdução

## Criar a função soma

Uma função recebe **parâmetros** e devolve um resultado.

> Nota: perguntar quem já usou funções.

```js arquivo="src/app.js" operacao="criar"
function soma(a, b) {
  return a + b
}
```
````

| Elemento               | Vira                                |
| ---------------------- | ----------------------------------- |
| `titulo:` no cabeçalho | título da aula                      |
| `# Título`             | fluxo                               |
| `## Título`            | passo                               |
| parágrafos             | legenda pública do passo            |
| `> Nota: …`            | notas privadas do apresentador      |
| bloco de código        | uma ação (na ordem em que aparecem) |

Os atributos ficam na primeira linha do bloco, no formato `nome="valor"`.

## Ações

### Código em arquivo

O primeiro termo é a linguagem (`js`, `python`, `java`…), usada só no realce.

````markdown
```js arquivo="src/app.js" operacao="acrescentar"
console.log(soma(2, 3))
```
````

| Atributo       | Valores                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `arquivo`      | caminho relativo à pasta; sem ele, usa o arquivo aberto no editor                                     |
| `operacao`     | `criar`, `acrescentar`, `inicio`, `inserir-depois`, `substituir`, `cursor`, `sobrescrever`, `excluir` |
| `texto`        | texto procurado por `substituir` e `inserir-depois` (use `\n` para quebras de linha)                  |
| `animacao`     | `digitar` (padrão), `transformar` (magic move) ou `nenhuma`                                           |
| `velocidade`   | milissegundos por caractere (padrão 30)                                                               |
| `quebra-final` | `nao` quando o conteúdo não termina com quebra de linha                                               |

### Terminal

````markdown
```terminal nome="Servidor"
npm run dev
```
````

`nome` escolhe (ou cria) o terminal; `enter="nao"` só digita o comando;
`digitar="nao"` envia tudo de uma vez. Cada linha é um comando.

### Esperar o terminal

````markdown
```esperar nome="Servidor" tempo="60"
ready in
```
````

O conteúdo é o texto esperado (ou `/regex/`); `tempo` em segundos.

### Slide

````markdown
```slide imagem="imagens/diagrama.png"
# Como funciona

- Entrada
- Processamento
```
````

### Destacar linhas

````markdown
```destacar arquivo="src/app.js" linhas="2-3"
O return devolve o resultado da função.
```
````

### Desafio

````markdown
```desafio tempo="5"
Crie uma função `triplo(x)` usando `soma`.
```
````

`tempo` em minutos (`0` = sem cronômetro).

### Preview e cena do OBS

````markdown
```preview
http://localhost:5173
```

```obs
Câmera
```
````

## Arquivo `.stepbystep/lesson.json`

É o formato salvo automaticamente pelo app (versão 2): `{ "version": 2, "title", "tree" }`,
onde `tree` é a lista de fluxos e passos e cada passo tem `data.actions`, `data.caption` e
`data.presenterNotes`. Aulas da versão 1 (uma ação por passo) são convertidas ao abrir.
