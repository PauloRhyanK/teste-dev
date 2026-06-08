# Teste Técnico — Desenvolvedor(a) Full-Stack · Quansa

Bem-vindo(a)! Este teste é uma conversa prática. Queremos entender **como você pensa e resolve problemas**, mais do que avaliar conhecimento técnico decorado. Fique à vontade para perguntar o que quiser ao longo do dia.

**Pode usar IA à vontade** (ChatGPT, Claude, Copilot — o que você já usa). É assim que trabalhamos aqui; só esperamos que você entenda e saiba explicar o que foi produzido.

Vamos **fornecer uma chave de API do Claude Code** para você usar à vontade durante o teste.

---

## Como vai funcionar

O teste tem três momentos, em cerca de 4 horas:

1. **Quadro branco (~45 min)** — conversamos sobre um problema real da Quansa e você desenha como resolveria. Você é o(a) dono(a) da caneta.
2. **Mãos na massa (~1h30)** — você desenvolve a solução do desafio abaixo, no seu ritmo.
3. **Apresentação (~30 min)** — você nos mostra o que construiu e explica as decisões que tomou.

---

## O desafio

Você recebeu uma planilha ([`planilha_teste_pagamentos.xlsx`](https://docs.google.com/spreadsheets/d/169dGl3zxkHdk3PyYYEF9KA2zPQreUuQO/edit?usp=sharing&ouid=101254844168636049749&rtpof=true&sd=true)) com duas abas:

- **`Lote de Pagamentos`** — a entrada: a lista de pagamentos a serem processados. Cada linha tem um **ID**, uma **data de pedido**, um **beneficiário** com seus **dados bancários** (CPF/CNPJ, banco, agência, conta, tipo) e um **valor**.
- **`Processamento de Pagamentos`** — a saída: onde você registra o resultado do processamento (veja **Saída esperada** abaixo).

Seu objetivo é construir uma solução que leia essa planilha, **aplique as regras de negócio abaixo** e execute os pagamentos válidos no **Stark Bank Sandbox**. A linguagem e as bibliotecas são sua escolha.

Os pagamentos são feitos **via Pix, usando os dados bancários** de cada beneficiário — o Stark Bank Sandbox aceita transferência por conta, então não é necessário chave Pix.

### Setup

- Você foi convidado(a) para o workspace de Sandbox da Quansa no Stark Bank — o convite chegou no seu **e-mail pessoal**. Aceite e acesse: **https://quansa.sandbox.starkbank.com/**
- Dentro do workspace da Quansa, crie o seu próprio **Projeto** para gerar as credenciais de API (ID do projeto e chave privada).
- Configure seu ambiente com essas credenciais para realizar os pagamentos por esse projeto.
- Use a documentação oficial do Stark Bank como referência — explorar a doc faz parte do desafio.

> **Credenciais:** não comite a chave privada nem o ID do projeto no repositório. Use variáveis de ambiente / um arquivo de configuração ignorado pelo `.gitignore`.

### Regras de negócio

- **Valor mínimo** por pagamento: R$ 10,00. Abaixo disso, não pode pagar.
- **Valor máximo** por pagamento: R$ 3.000,00. Acima disso, não pode pagar.
- **Dados de beneficiário inválidos** (ex.: CPF inválido) não devem ser pagos.
- **Um pagamento por beneficiário por dia.** Se o mesmo beneficiário (mesmo CPF/conta) aparecer em mais de uma linha no mesmo dia, some os valores e faça um único pagamento.

### Saída esperada

Ao final, preencha a aba **`Processamento de Pagamentos`** — **uma linha por pagamento processado**. Como vale a regra de *um pagamento por beneficiário por dia*, quando o mesmo beneficiário aparece em mais de uma linha no mesmo dia na aba `Lote de Pagamentos`, ele vira **uma única linha** aqui, já com os **valores somados**.

Para cada pagamento, preencha as colunas:

- **Data do Pagamento**, **Beneficiário**, **CPF/CNPJ**, **Banco**, **Agência**, **Conta**, **Tipo** e **Valor (R$)** — os dados do pagamento (com o valor já somado quando houver mais de uma linha do mesmo beneficiário no dia).
- **Status** — `PAGO` ou `NÃO PAGO`.
- **Motivo** — quando não pago, o motivo: erro de validação (qual regra) ou erro no momento do pagamento (o que o Stark Bank retornou).

---

## Entrega final

O trabalho fica em um **repositório Git**. Pedimos que:

1. **Comite ao longo do caminho** — commits pequenos que contam a história do que você foi fazendo, não um único commit gigante no fim.
2. **Entregue o resultado** de uma destas formas:
   - **Abra um Pull Request** neste repositório com a sua solução; ou
   - suba para **um repositório seu** e compartilhe o link.

   Em qualquer caso, avise / adicione **edmilsonlani@gmail.com**.
3. **Atualize este README** com uma seção `## Como funciona` explicando:
   - como rodar o projeto (passo a passo);
   - como sua solução está organizada e por quê;
   - as principais decisões que você tomou e o que faria diferente com mais tempo.

---

## Dicas

- **Pergunte.** Esclarecer o problema antes de codar é um ótimo sinal, não o contrário.
- **Não precisa terminar tudo.** Preferimos decisões bem pensadas a um código corrido que você não consegue explicar.
- **Pense em quem está do outro lado:** cada pagamento é o adiantamento de salário de um trabalhador de verdade.
