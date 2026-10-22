---
titulo: Python do zero
---

# Começando

## Por que Python

Python é simples de ler e muito usado em dados, automação e web.

> Nota: no Linux o comando costuma ser python3. Troque no campo "python" das variáveis de cada comando (editor do passo) se precisar.

```slide transicao="fade"
# Python do zero

- Código limpo, quase como inglês
- **Indentação** faz parte da linguagem
- `python arquivo.py` executa um arquivo
```

## Conferir a instalação

```terminal
[[python:python]] --version
```

## Olá, mundo

```python arquivo="ola.py" operacao="criar"
print("Olá, mundo!")
```

```terminal
[[python:python]] ola.py
```

# O básico

## Variáveis

Em Python não se declara o tipo: o valor decide.

```python arquivo="basico.py" operacao="criar"
nome = "Ana"
idade = 20
altura = 1.65

print(f"{nome} tem {idade} anos e {altura} m")
```

```terminal
[[python:python]] basico.py
```

## Decisões com if

```python arquivo="basico.py" operacao="acrescentar"

if idade >= 18:
    print("Maior de idade")
else:
    print("Menor de idade")
```

```terminal
[[python:python]] basico.py
```

## A indentação importa

```destacar arquivo="basico.py" linhas="7-10"
Os quatro espaços dizem o que está dentro do if e do else.
```

## Repetição com for

```python arquivo="lista.py" operacao="criar"
frutas = ["maçã", "banana", "uva"]

for fruta in frutas:
    print("Eu gosto de", fruta)

print("Total:", len(frutas))
```

```terminal
[[python:python]] lista.py
```

## Funções

```python arquivo="lista.py" operacao="acrescentar"

def dobro(numero):
    return numero * 2

for n in range(1, 4):
    print(n, "->", dobro(n))
```

```terminal
[[python:python]] lista.py
```

# Prática

## Laboratório

Mude as frutas, rode com ▶ (Ctrl+Enter) e continue com **F8**.

```laboratorio arquivo="lista.py" layout="lado-a-lado"
[[python:python]] lista.py
```

## Desafio

```desafio tempo="5"
## Sua vez

Escreva `eh_par(numero)` que devolve `True` para números pares
e mostre os pares de 1 a 10.
```
