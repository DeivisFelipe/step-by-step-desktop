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

Opções do slide: `transicao` (`fade`, `slide-left`, `slide-up`, `zoom`, `blur`, `flip`,
`wipe` ou `none`) e `telacheia="sim"` / `"nao"` (sem eles, vale o estilo da apresentação).

Slide em **HTML**, com estilos, scripts e animações próprios, pensado para 1920×1080.
Caminhos relativos apontam para a pasta do projeto:

````markdown
```slide formato="html" transicao="zoom" telacheia="sim"
<style>
  body { display: grid; place-items: center; background: #0f172a; }
  h1 { font-size: 120px; animation: entrar 900ms both; }
  @keyframes entrar { from { opacity: 0; transform: translateY(60px); } }
</style>
<h1>Qual caminho seguimos?</h1>
<button onclick="proximoPasso(0)">PHP</button>
<button onclick="proximoPasso(1)">Python</button>
<button onclick="rodarComando('php -v')">▶ Ver a versão</button>
```
````

No slide em HTML existem duas funções:

| Função                        | O que faz                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `proximoPasso(n)`             | escolhe a opção `n` (0 = primeira) do menu do passo; sem menu, vai ao passo `n` ou ao título |
| `rodarComando('cmd', 'Nome')` | roda o comando no terminal (o nome é opcional); voltar o passo interrompe o que ele iniciou  |

Os botões funcionam no app e nas páginas abertas com a chave (visão do apresentador).

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

### Laboratório (código + terminal)

````markdown
```laboratorio arquivo="ola.php" layout="lado-a-lado" nome="Lab"
php ola.php
```
````

Abre o arquivo para editar ao vivo e mostra código e terminal juntos no palco
(`layout`: `lado-a-lado`, `empilhado` ou `abas`). O conteúdo é o comando que o ▶
(ou `Ctrl+Enter`) roda; `F8` continua a aula.

## Caminhos

Por padrão a aula segue a lista de passos. Estas ações mudam o próximo passo; o destino
é escrito com o **título do passo** depois de `->`. Sem destino, segue a lista.

### Menu de escolha

````markdown
```escolha titulo="Qual linguagem?" variavel="trilha"
PHP -> Introdução ao PHP
Python -> Introdução ao Python
```
````

O passo espera o professor escolher (clique, teclas `1`–`9`, visão do apresentador ou
`proximoPasso(n)` num slide em HTML) e o passo escolhido roda em seguida. `variavel`
guarda o texto da opção; `palco="nao"` não mostra o menu para a turma.

### Se / senão

````markdown
```se
saida contem "OK" -> Tudo certo
arquivo existe "vendor/autoload.php" -> Usar o Composer
arquivo contem "index.php" "echo" -> Rodar o index
variavel trilha = "PHP" -> Introdução ao PHP
senao -> Tentar de novo
```
````

As linhas são testadas em ordem; a primeira verdadeira decide. `saida contem` olha a saída
do último comando do terminal (`terminal="Nome"` escolhe qual).

### Ir para

````markdown
```irpara
Resumo
```
````

Usado no fim de um caminho do menu para voltar ao caminho principal, ou para repetir passos.

No **diagrama do fluxo**, cada opção de menu, condição e "ir para" tem uma bolinha à
direita do cartão: puxe-a até o passo de destino. A bolinha embaixo do cartão cria um
"ir para". Selecione uma ligação e aperte Delete para removê-la.

## Arquivo `.stepbystep/lesson.json`

É o formato salvo automaticamente pelo app (versão 2): `{ "version": 2, "title", "tree" }`,
onde `tree` é a lista de fluxos e passos e cada passo tem `data.actions`, `data.caption` e
`data.presenterNotes`. Aulas da versão 1 (uma ação por passo) são convertidas ao abrir.
