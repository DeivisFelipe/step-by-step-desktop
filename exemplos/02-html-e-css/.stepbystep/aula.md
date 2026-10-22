---
titulo: Primeira página com HTML e CSS
---

# HTML

## O que é HTML

O **HTML** diz o que existe na página; o **CSS** diz como ela aparece.

> Nota: não precisa instalar nada; o preview abre a página dentro do app.

```slide transicao="fade"
# HTML e CSS

- **HTML**: o conteúdo (títulos, textos, imagens, links)
- **CSS**: a aparência (cores, tamanhos, posições)
- O navegador junta os dois e desenha a página
```

## O esqueleto da página

Toda página começa com este esqueleto.

```html arquivo="index.html" operacao="criar" velocidade="20"
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>Minha página</title>
  </head>
  <body>
  </body>
</html>
```

## As partes do esqueleto

```destacar arquivo="index.html" linhas="3-6"
O head guarda informações sobre a página: o título da aba, o idioma dos caracteres…
```

## Conteúdo no body

Tudo o que aparece na tela fica dentro do **body**.

```html arquivo="index.html" operacao="inserir-depois" texto="<body>"

    <h1>Olá, mundo!</h1>
    <p>Esta é a minha primeira página.</p>
    <ul>
      <li>Aprender HTML</li>
      <li>Aprender CSS</li>
    </ul>
```

## Ver no navegador

```preview
index.html
```

# CSS

## O que é CSS

````slide transicao="slide-left"
# CSS: regras de estilo

```css
seletor {
  propriedade: valor;
}
```

- O **seletor** escolhe os elementos
- Cada **propriedade** muda um detalhe
````

## Criar o arquivo de estilo

```css arquivo="estilo.css" operacao="criar"
body {
  font-family: sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  padding: 40px;
}

h1 {
  color: #38bdf8;
}
```

## Ligar o CSS ao HTML

A tag **link** diz ao navegador onde está o estilo.

```html arquivo="index.html" operacao="inserir-depois" texto="<title>Minha página</title>"

    <link rel="stylesheet" href="estilo.css">
```

## Ver o resultado

```preview
index.html
```

## Destacar a regra do título

```destacar arquivo="estilo.css" linhas="8-10"
Só os títulos h1 ficam azuis.
```

## Desafio

```desafio tempo="5"
## Sua vez

1. Mude a cor de fundo em **estilo.css**
2. Adicione um item na lista
3. Deixe os itens da lista em **negrito** (`font-weight: bold`)
```
