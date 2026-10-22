---
titulo: Galeria de slides em HTML
---

# Designs

## Capa com gradiente animado

Modelos de slides em HTML para copiar e adaptar. Cada passo usa uma transição diferente.

> Nota: abra o passo no editor para ver e copiar o HTML. Os slides são pensados para 1920×1080.

```slide formato="html" transicao="fade"
<style>
  body {
    display: grid;
    place-items: center;
    background: linear-gradient(120deg, #f97316, #db2777, #7c3aed, #2563eb);
    background-size: 300% 300%;
    animation: fundo 8s ease infinite;
  }
  .capa {
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 140px;
    letter-spacing: -4px;
  }
  p {
    margin: 20px 0 0;
    font-size: 48px;
    opacity: 0.9;
  }
  @keyframes fundo {
    50% {
      background-position: 100% 50%;
    }
  }
</style>
<div class="capa">
  <h1>Título da aula</h1>
  <p>Subtítulo · Professor · Data</p>
</div>
```

## Tópicos que entram um a um

```slide formato="html" transicao="slide-left"
<style>
  body {
    padding: 120px 160px;
    box-sizing: border-box;
    background: #0f172a;
  }
  h2 {
    margin: 0 0 60px;
    font-size: 84px;
    color: #38bdf8;
  }
  li {
    margin: 28px 0;
    font-size: 56px;
    list-style: none;
    opacity: 0;
    animation: entrar 600ms ease forwards;
  }
  li::before {
    content: '→ ';
    color: #f472b6;
  }
  li:nth-child(2) {
    animation-delay: 0.6s;
  }
  li:nth-child(3) {
    animation-delay: 1.2s;
  }
  li:nth-child(4) {
    animation-delay: 1.8s;
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateX(-60px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
<h2>O que vamos ver</h2>
<ul>
  <li>Primeiro tópico</li>
  <li>Segundo tópico</li>
  <li>Terceiro tópico</li>
  <li>Prática no final</li>
</ul>
```

## Duas colunas com ilustração

```slide formato="html" transicao="slide-up"
<style>
  body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 80px;
    padding: 0 140px;
    box-sizing: border-box;
    background: #f8fafc;
    color: #0f172a;
  }
  h2 {
    font-size: 80px;
    margin: 0 0 30px;
  }
  p {
    font-size: 44px;
    line-height: 1.4;
    margin: 0;
    color: #334155;
  }
  svg {
    width: 100%;
  }
  .gira {
    transform-origin: 300px 300px;
    animation: girar 12s linear infinite;
  }
  @keyframes girar {
    to {
      transform: rotate(360deg);
    }
  }
</style>
<div>
  <h2>Texto e imagem</h2>
  <p>Explique a ideia à esquerda e mostre um desenho, foto ou diagrama à direita.</p>
</div>
<svg viewBox="0 0 600 600">
  <circle cx="300" cy="300" r="260" fill="#e0e7ff" />
  <g class="gira">
    <circle cx="300" cy="80" r="50" fill="#6366f1" />
    <circle cx="510" cy="300" r="50" fill="#ec4899" />
    <circle cx="300" cy="520" r="50" fill="#14b8a6" />
    <circle cx="90" cy="300" r="50" fill="#f59e0b" />
  </g>
  <circle cx="300" cy="300" r="90" fill="#4338ca" />
</svg>
```

## Número em destaque

O número conta até o valor com um script.

```slide formato="html" transicao="zoom"
<style>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, #065f46, #022c22);
  }
  .numero {
    font-size: 320px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  p {
    font-size: 56px;
    margin: 20px 0 0;
    opacity: 0.85;
  }
</style>
<div class="numero" id="numero">0</div>
<p>alunos já fizeram este curso</p>
<script>
  const alvo = 1250
  const el = document.getElementById('numero')
  const inicio = performance.now()
  function passo(agora) {
    const t = Math.min(1, (agora - inicio) / 2000)
    el.textContent = Math.round(alvo * (1 - Math.pow(1 - t, 3))).toLocaleString('pt-BR')
    if (t < 1) requestAnimationFrame(passo)
  }
  requestAnimationFrame(passo)
</script>
```

## Linha do tempo

```slide formato="html" transicao="flip" telacheia="sim"
<style>
  body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 120px;
    box-sizing: border-box;
    background: #1e1b4b;
  }
  h2 {
    font-size: 80px;
    margin: 0 0 100px;
  }
  .linha {
    position: relative;
    display: flex;
    justify-content: space-between;
  }
  .linha::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 30px;
    height: 8px;
    background: #6366f1;
    transform-origin: left;
    animation: crescer 1.5s ease both;
  }
  .marco {
    position: relative;
    width: 300px;
    text-align: center;
    opacity: 0;
    animation: aparecer 500ms ease forwards;
  }
  .marco::before {
    content: '';
    display: block;
    width: 68px;
    height: 68px;
    margin: 0 auto 30px;
    border-radius: 50%;
    background: #f472b6;
  }
  .marco b {
    display: block;
    font-size: 56px;
  }
  .marco span {
    font-size: 36px;
    opacity: 0.8;
  }
  .marco:nth-child(1) {
    animation-delay: 0.3s;
  }
  .marco:nth-child(2) {
    animation-delay: 0.8s;
  }
  .marco:nth-child(3) {
    animation-delay: 1.3s;
  }
  .marco:nth-child(4) {
    animation-delay: 1.8s;
  }
  @keyframes crescer {
    from {
      transform: scaleX(0);
    }
  }
  @keyframes aparecer {
    to {
      opacity: 1;
    }
  }
</style>
<h2>Linha do tempo (tela cheia)</h2>
<div class="linha">
  <div class="marco"><b>1991</b><span>Python</span></div>
  <div class="marco"><b>1995</b><span>JavaScript e PHP</span></div>
  <div class="marco"><b>2005</b><span>Git</span></div>
  <div class="marco"><b>Hoje</b><span>Sua aula</span></div>
</div>
```

# Interação

## Quiz com botões

Os botões chamam `proximoPasso(n)`: a resposta escolhida decide o próximo passo.

> Nota: a resposta certa é a segunda (aperte 2 ou clique nela).

```slide formato="html" transicao="wipe"
<style>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 40px;
    background: #0f172a;
  }
  h2 {
    font-size: 76px;
    margin: 0 0 30px;
  }
  button {
    width: 1100px;
    padding: 34px;
    border: 4px solid #334155;
    border-radius: 28px;
    background: #1e293b;
    color: white;
    font-size: 52px;
    text-align: left;
    cursor: pointer;
  }
  button:hover {
    border-color: #38bdf8;
  }
</style>
<h2>Qual comando mostra o histórico do Git?</h2>
<button onclick="proximoPasso(0)">A) git status</button>
<button onclick="proximoPasso(1)">B) git log</button>
<button onclick="proximoPasso(2)">C) git init</button>
```

```escolha titulo="Resposta do quiz" palco="nao"
A) git status -> Tente de novo
B) git log -> Resposta certa
C) git init -> Tente de novo
```

## Tente de novo

```slide formato="html" transicao="blur"
<style>
  body {
    display: grid;
    place-items: center;
    background: #7f1d1d;
    font-size: 90px;
    font-weight: 700;
  }
</style>
<div>Quase! Tente outra vez.</div>
```

```irpara
Quiz com botões
```

## Resposta certa

```slide formato="html" transicao="zoom"
<style>
  body {
    display: grid;
    place-items: center;
    background: #14532d;
    font-size: 100px;
    font-weight: 700;
  }
  div {
    animation: pulo 600ms ease both;
  }
  @keyframes pulo {
    50% {
      transform: scale(1.15);
    }
  }
</style>
<div>Isso! git log ✔</div>
```

## Botão que roda um comando

`rodarComando('...')` executa no terminal; o palco mostra o resultado.

```slide formato="html" transicao="slide-left"
<style>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 50px;
    background: #111827;
  }
  h2 {
    font-size: 76px;
    margin: 0;
  }
  button {
    padding: 36px 70px;
    border: 0;
    border-radius: 999px;
    background: #22c55e;
    color: #052e16;
    font-size: 60px;
    font-weight: 800;
    cursor: pointer;
  }
</style>
<h2>Que horas são no computador?</h2>
<button onclick="rodarComando('date')">▶ Rodar date</button>
```
