# Live Market Window Spec (Rodovia 5 Min)

## Objetivo
Padronizar o ciclo de mercados live de janela curta para casos como rodovia:
- opcao A: `menos de 20`
- opcao B: `mais de 20`

Usuarios apostam durante uma janela fixa, o mercado fecha, resolve com o dado medido e reabre em nova rodada.

## Ciclo de Vida
1. `ABERTO`
   - aceita apostas
   - mostra tempo restante da janela
2. `FECHADO`
   - bloqueia novas apostas
   - aguarda consolidacao da medicao
3. `RESOLVENDO`
   - calcula resultado oficial
   - escolhe opcao vencedora
4. `RESOLVIDO`
   - liquida ganhos/perdas
   - gera ledger de payouts
5. `REABRINDO`
   - cria nova rodada com nova janela de 5 min
   - volta para `ABERTO`

## Regras de Motor (pool/AMM)
- tipo de mercado: `livePool`
- janela padrao: `5 minutos`
- valor minimo da aposta: `R$ 1,00`
- odds com clamp de seguranca: `[0.01, 0.99]`
- bloquear aposta quando status != `ABERTO`

## Guardrails Operacionais
- **Idempotencia de resolucao**: cada rodada pode ser resolvida uma unica vez.
- **Idempotencia de payout**: cada bet recebe liquidacao no maximo uma vez.
- **Clock unico**: usar horario de servidor para fechar janela.
- **Reprocessamento seguro**: job de recuperacao para rodadas em estado intermediario.
- **Auditoria**: registrar `market_type`, `engine`, `window_start`, `window_end`, `resolved_by`.

## Contrato de Dados Minimo por Rodada
- `round_id`
- `market_id`
- `window_start_at`
- `window_end_at`
- `status` (`ABERTO` | `FECHADO` | `RESOLVENDO` | `RESOLVIDO`)
- `threshold_value` (ex.: 20)
- `winning_option` (`menos_de_20` | `mais_de_20`)
- `measured_value` (ex.: contagem final de carros)

## UX Padrao
- selecao de opcao fica no bloco central
- painel direito focado em:
  - opcao selecionada
  - valor da aposta
  - retorno estimado
  - botao confirmar
- esconder livro de ordens em `livePool`

