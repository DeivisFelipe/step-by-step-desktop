# Política de privacidade / Privacy policy

## Português

O Step-by-Step Code **não coleta, não armazena e não envia dados pessoais**, de uso ou de
telemetria. Suas aulas, arquivos e configurações ficam apenas no seu computador.

O app só se comunica com outros sistemas nestes casos:

| Conexão                                            | Quando                                                          | O que é enviado                                                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub** (`github.com`, `githubusercontent.com`) | Ao abrir e periodicamente, para verificar e baixar atualizações | Apenas a requisição pela lista de versões e pelo instalador, como qualquer download. Sujeito à [declaração de privacidade do GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).                         |
| **Servidor local de apresentação**                 | Enquanto o app está aberto                                      | Escuta só em `127.0.0.1` (o próprio computador). Só fica acessível na rede local se você ativar **Compartilhar na rede local**; nesse caso, quem estiver na rede vê o código e a legenda da aula. As notas do apresentador exigem uma chave privada. |
| **OBS Studio**                                     | Só se você ativar a conexão com o OBS                           | Comandos de troca de cena e capítulos, para o endereço que você configurar.                                                                                                                                                                          |
| **Endereços que você usar nos passos**             | Só ao executar um passo de preview ou de terminal               | O que o próprio passo pedir (por exemplo, abrir `http://localhost:5173` ou rodar `npm install`).                                                                                                                                                     |

## English

Step-by-Step Code **does not collect, store or send personal, usage or telemetry data**. Your
lessons, files and settings stay on your computer.

This program will not transfer any information to other networked systems unless
specifically requested by the user, with this exception: it checks **GitHub**
(`github.com`, `githubusercontent.com`) for new versions when it starts and periodically,
and downloads the installer of a new version. Only the version list and the installer are
requested, like any download, subject to the
[GitHub General Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

- The built-in presentation server listens on `127.0.0.1` only. It is reachable from the local
  network only if the user enables **Share on the local network**.
- The OBS Studio connection is made only if the user enables it, to the address they configure.
- Preview and terminal steps access only what the lesson author wrote in them.
