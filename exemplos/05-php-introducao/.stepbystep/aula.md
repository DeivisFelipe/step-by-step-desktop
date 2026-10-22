---
titulo: Introdução ao PHP
---

# 1. O que é PHP

## Abertura

Hoje: uma introdução prática ao **PHP**.

> Nota: Apresentar-se e perguntar quem já programou em alguma linguagem. Comentar que o Moodle da universidade é feito em PHP.

```slide
# Introdução ao PHP

- Linguagem para criar **páginas e sistemas web**
- Roda no **servidor**, não no navegador
- Usada no WordPress, Laravel, Moodle e milhões de sites
- Fácil de começar: um arquivo `.php` já é um programa
```

## Como o PHP funciona

O PHP é executado no **servidor** e devolve HTML para o navegador.

> Nota: Diferença para o JavaScript: o JS roda no navegador; o PHP roda antes, no servidor.

```slide
## Como funciona

1. O navegador pede uma página: `index.php`
2. O **servidor** executa o código PHP
3. O PHP gera **HTML**
4. O navegador recebe só o HTML pronto

> O usuário nunca vê o código PHP, só o resultado.
```

## Preparar o terminal

Conferindo a versão do PHP instalada.

> Nota: precisa do PHP instalado (php.net, XAMPP no Windows ou "sudo apt install php-cli" no Linux). Se o comando php não for encontrado, coloque a pasta do PHP no PATH.

```terminal
php -v
```

# 2. Primeiro script

## Olá, mundo

Todo arquivo PHP começa com `<?php`. O `echo` mostra um texto.

> Nota: Chamar atenção para o ponto e vírgula no fim da linha.

```php arquivo="ola.php" operacao="criar" velocidade="25"
<?php

echo "Olá, mundo!\n";
```

## Executar no terminal

O comando `php` executa o arquivo direto no terminal.

```terminal
php ola.php
```

## A tag de abertura

A tag `<?php` avisa que ali começa o código.

```destacar arquivo="ola.php" linhas="1-1"
Tudo depois de <?php é interpretado como código PHP.
```

# 3. Variáveis e tipos

## Criar variáveis

Variáveis começam com `$`. O tipo é definido pelo valor guardado.

> Nota: Dá para trocar o nome e a idade antes de executar: são variáveis do passo.

```php arquivo="variaveis.php" operacao="criar" velocidade="25"
<?php

$nome = "[[Nome:Ana]]";
$idade = [[Idade:20]];
$altura = 1.65;
$estudante = true;
```

## Mostrar com interpolação

Entre aspas duplas, o PHP troca `$nome` pelo valor da variável.

```php arquivo="variaveis.php" operacao="acrescentar" velocidade="25"

echo "Olá, $nome! Você tem $idade anos.\n";
```

```terminal
php variaveis.php
```

## Os tipos de cada variável

`var_dump` mostra o **tipo** e o **valor** de cada variável.

```destacar arquivo="variaveis.php" linhas="3-6"
string, int, float e bool: o PHP descobre o tipo sozinho.
```

```php arquivo="variaveis.php" operacao="acrescentar" velocidade="25"
var_dump($idade, $altura, $estudante);
```

```terminal
php variaveis.php
```

# 4. Decisões e repetições

## if / else

O `if` escolhe o que executar de acordo com uma condição.

> Nota: Trocar a variável Nota para 6 e depois 3 e executar o passo de novo (Ir até este passo).

```php arquivo="condicoes.php" operacao="criar" velocidade="25"
<?php

$nota = [[Nota:8]];

if ($nota >= 7) {
    echo "Aprovado com nota $nota\n";
} elseif ($nota >= 5) {
    echo "Em recuperação\n";
} else {
    echo "Reprovado\n";
}
```

```terminal
php condicoes.php
```

## Laço for

O `for` repete um bloco um número definido de vezes. O ponto (`.`) junta textos.

```php arquivo="repeticao.php" operacao="criar" velocidade="25"
<?php

$numero = [[Tabuada:7]];

for ($i = 1; $i <= 10; $i++) {
    echo "$numero x $i = " . ($numero * $i) . "\n";
}
```

```terminal
php repeticao.php
```

## Arrays e foreach

Um **array** guarda vários valores. O `foreach` percorre cada um deles.

```php arquivo="repeticao.php" operacao="acrescentar" velocidade="25"

$linguagens = ["PHP", "JavaScript", "Python"];

foreach ($linguagens as $linguagem) {
    echo "- $linguagem\n";
}
```

```terminal
php repeticao.php
```

# 5. Funções

## Criar uma função

Uma **função** recebe parâmetros e devolve um resultado com `return`.

> Nota: Explicar que os tipos (int) são opcionais, mas ajudam a evitar erros.

```php arquivo="funcoes.php" operacao="criar" velocidade="25"
<?php

function soma(int $a, int $b): int
{
    return $a + $b;
}

echo soma(2, 3) . "\n";
```

```terminal
php funcoes.php
```

## Parâmetro com valor padrão

Parâmetros podem ter um **valor padrão**, usado quando nada é informado.

```php arquivo="funcoes.php" operacao="inserir-depois" texto="    return $a + $b;\n}\n" animacao="transformar"

function saudacao(string $nome = "turma"): string
{
    return "Bem-vinda(o), $nome!";
}
```

```php arquivo="funcoes.php" operacao="acrescentar" velocidade="25"
echo saudacao() . "\n";
echo saudacao("Ana") . "\n";
```

```terminal
php funcoes.php
```

# 6. PHP na web

## Uma página com PHP

O PHP pode ficar **dentro do HTML**. `<?= ?>` é um atalho para `echo`.

```php arquivo="index.php" operacao="criar" velocidade="15"
<?php date_default_timezone_set("America/Sao_Paulo"); ?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Minha primeira página PHP</title>
</head>
<body>
    <h1>Olá, turma!</h1>
    <p>Hoje é <?= date("d/m/Y") ?> e são <?= date("H:i") ?>.</p>

    <ul>
        <?php foreach (["HTML", "CSS", "PHP"] as $item): ?>
            <li><?= $item ?></li>
        <?php endforeach; ?>
    </ul>
</body>
</html>
```

## Subir o servidor

O PHP já vem com um servidor web para desenvolvimento.

> Nota: Este terminal fica rodando o servidor; os outros comandos continuam no Terminal 1.

```terminal nome="Servidor"
php -S localhost:8000
```

```esperar nome="Servidor" tempo="20"
started
```

## Ver no navegador

O navegador recebe só o **HTML** gerado. A data muda a cada acesso.

> Nota: Abrir o "ver código-fonte" no navegador para mostrar que o PHP não aparece.

```preview
http://localhost:8000
```

# 7. Encerramento

## Desafio

Mãos à obra: 5 minutos!

```desafio tempo="5"
## Desafio

Crie `filmes.php` com um **array** dos seus 3 filmes favoritos e mostre cada um numa lista usando `foreach`.

Bônus: mostre também quantos filmes há com `count()`.
```

## Resumo e próximos passos

Obrigado! Dúvidas?

```slide
## O que vimos

- `<?php`, `echo` e o ponto e vírgula
- Variáveis com `$` e tipos automáticos
- `if`, `for`, arrays e `foreach`
- Funções com `return` e valor padrão
- PHP dentro do HTML e o servidor embutido

**Próximos passos:** formulários (`$_GET` e `$_POST`), banco de dados com PDO e o framework Laravel.
```
