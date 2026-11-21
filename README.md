# PolySend

**PolySend** é uma demo de e-mails escritos **em tempo real** com os modelos do **OpenCode Go**.

![Preview do PolySend](img/tela-cheia.png)

A interface é um **único painel responsivo** (sem scroll na página): briefing à esquerda,
e-mail no centro e catálogo à direita. A barra de consumo do plano fica sempre visível logo
abaixo do e-mail. Em telas menores o catálogo vira um drawer e, no celular, a navegação vira
abas (Briefing / E-mail / Modelos).

O catálogo Go ao vivo (31 modelos no momento) mostra preços por 1M de tokens, limite mensal por
modelo e o consumo real do plano (janela de 5h, semana e mês). O texto é transmitido token a
token por SSE e pode ser editado, refinado ou reescrito por seleção.

```
React + Vite  ·  Node/Express  ·  OpenCode Go API  ·  SSE
```

## Rodar

Requisitos: Node 20+.

```bash
npm install
cp .env.example .env   # se ainda não existir um .env
npm run dev
```

Abra `http://localhost:5173`.

No Windows (PowerShell), use:

```powershell
Copy-Item .env.example .env
npm run dev
```

O `.env` deste projeto já está preenchido e o servidor lê a chave de lá. Você também pode
colar outra chave direto no painel **Configurar API**, sem reiniciar nada.

### Build de produção

```bash
npm run build
npm start
```

Abre em `http://localhost:8787` (Express serve o build do Vite e as rotas `/api`).

## Como a demo funciona

1. **Catálogo ao vivo** — a lista vem de `GET https://opencode.ai/inference/go/v1/models`.
   Mostra nome, preço de entrada/saída, contexto, badges de ZDR/grátis e limite mensal por
   modelo no plano escolhido (Go, Go Plus ou Go Teams).
2. **Briefing** — destinatário, empresa, objetivo, tom, extensão, idioma, contexto e assinatura.
   Quatro exemplos prontos: orçamento, follow-up, reunião e cobrança.
3. **Streaming de verdade** — o backend abre o stream da API Go e repassa os deltas via SSE.
   O assunto é separado do corpo no primeiro trecho da resposta.
4. **Consumo do plano** — `GET https://opencode.ai/inference/go/v1/usage` retorna as janelas
   reais de 5h, semana e mês. A cada geração o painel é atualizado; ele também atualiza sozinho
   a cada 60s. Cada resposta traz `usage.opencode.allowance`, usado no acumulado da sessão.
5. **Manipulação de texto** — depois de gerar, clique em **Editar texto** para editar à mão.
   Selecione um trecho e peça uma reescrita só daquele trecho. Os chips **Ajustar com IA**
   reescrevem o corpo inteiro (mais curto, formal, persuasivo, CTA, tradução), também em stream.

### Roteiro sugerido para a live

1. Abra o app e mostre o catálogo à direita: 31 modelos, preços e limites. Para uma live mais
   fluida, use **GLM-5.3-Flash** (o padrão) ou **Claude Haiku 5.5** — modelos com raciocínio
   longo podem demorar mais para o primeiro token.
2. Clique em **Pedir orçamento** (ou digite um briefing), depois em **Gerar e-mail**. Aponte
   para o assunto e o corpo sendo escritos ao vivo, o caret e o indicador **AO VIVO**.
3. Terminada a geração, mostre os tokens, TTFT e tok/s na barra inferior do e-mail e o consumo
   real do plano (5h / semana / mês) sempre visível logo abaixo.
4. Clique em **Editar texto**, selecione um parágrafo e reescreva só ele com uma instrução
   (“mais direto, foco no prazo”). Mostre a substituição em tempo real.
5. Use **Mais curto** e **Traduzir p/ inglês** para mostrar refinamento sobre um texto existente.
6. Abra **Configurar API**, cole a chave do seu amigo e mostre a validação ao vivo (o catálogo
   recarrega na hora).
7. Para fechar, abra o **Console** pelo link da barra de consumo ou mostre
   `https://opencode.ai/console/go` com as janelas reais.

## Arquitetura

```
src/
  App.tsx                 estado da sessão, streaming, atalhos, conexão
  components/
    Header.tsx            status da chave e plano
    BriefingPanel.tsx     formulário + exemplos
    EmailCanvas.tsx       papel do e-mail, edição, seleção e refinamentos
    UsageBar.tsx          consumo real do plano + métricas da sessão
    ModelsPanel.tsx       catálogo Go ao vivo, busca, filtros e planos
    MobileTabs.tsx        navegação Briefing / E-mail / Modelos no celular
    KeyModal.tsx          configuração da API pelo painel
  lib/
    api.ts                fetch + parser SSE
    presets.ts            briefing, tons, extensões e instruções
server/
  index.mjs               rotas Express, SSE e validação
  opencode.mjs            cliente da API Go (modelos, usage, chat completions)
  prompts.mjs             prompts de geração, refinamento e seleção
```

### Endpoints do backend

| Método | Rota                | O que faz |
| ------ | ------------------- | --------- |
| GET    | `/api/health`       | status do servidor e se há chave no `.env` |
| GET    | `/api/models`       | catálogo Go normalizado (usa a chave do `.env` ou `x-opencode-key`) |
| GET    | `/api/usage`        | janelas reais de consumo do plano Go |
| POST   | `/api/email/stream` | gera/refina e transmite SSE (`subject`, `delta`, `usage`, `done`, `error`) |

O cliente escolhe o modelo, o briefing e o modo (`generate`, `refine` ou `selection`). O
backend monta os prompts e chama `https://opencode.ai/inference/go/openai/v1/chat/completions`
com `stream: true`, `stream_options.include_usage` e um `x-opencode-session` estável.

### Modelos e raciocínio

Todos os modelos de texto funcionam pelo endpoint de Chat Completions do Go (o Console traduz
quando o modelo fala outra API). Para respostas mais rápidas em e-mails, o app envia
`reasoning_effort` baixo quando o modelo declara suporte; modelos que só aceitam esforço alto
ficam no padrão.

## Nota sobre o OpenCode Go

O Go é pensado para **tráfego de coding agents** e a OpenCode monitora abuso que degrade a
experiência de outros usuários. Esta demo manda um User-Agent próprio e um `x-opencode-session`
estável, mas geração de e-mails não é o caso de uso principal do Go. Para um produto em produção,
o caminho recomendado é usar **OpenCode Models pay-as-you-go** ou as chaves dos seus próprios
providers. Para a demo ao vivo com amigos, o Go funciona bem.

## Chave de API e segurança

- A chave do `.env` fica **somente no backend** e nunca é enviada ao navegador.
- A chave colada no painel fica no `sessionStorage` daquela aba e é enviada ao **seu backend
  local** apenas nas requisições; o servidor não grava a chave em disco.
- Para produção, mantenha a chave só no servidor e remova a possibilidade de o cliente enviar
  `x-opencode-key` (ou proteja o app com autenticação). Este projeto é uma demo local: não
  exponha o servidor publicamente sem autenticação/rate limit.
- `.env` está no `.gitignore`. Não faça commit da sua chave. Se ela vazar, revogue e crie outra
  no Console em **Account › Personal API keys**.

## Ajustes rápidos

- **Mudar os exemplos**: `src/lib/presets.ts`.
- **Mudar o tom dos prompts**: `server/prompts.mjs`.
- **Mudar o modelo inicial**: `MODEL_STORAGE`/`selectedId` em `src/App.tsx`.
- **Mudar as cores**: variáveis CSS no topo de `src/styles.css`.
- **Outro plano como padrão**: seletor `plan` em `src/App.tsx` (Go, Go Plus, Go Teams).

## Documentação

- OpenCode Go: <https://opencode.ai/docs/console/go>
- API de inferência: <https://opencode.ai/docs/console/api/inference>
- Lista de modelos: <https://opencode.ai/docs/console/api/models>
- Console: <https://opencode.ai/console>
