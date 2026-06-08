# HANDOFF_PROTOCOL.md

Protocolo de handoff entre sessões do Claude Code neste projeto. Define quando
escrever um handoff, o que ele deve conter e o ciclo de vida do arquivo
`HANDOFF.md`. Complementa o CLAUDE.md (ver §7 "Fluxo de trabalho" e §9, regra 9).

---

## 1. Objetivo

Garantir continuidade entre sessões: a próxima sessão (ou o próprio usuário) deve
conseguir retomar o trabalho sem reconstruir contexto a partir do zero. O handoff
é a ponte entre o que foi feito e a próxima ação concreta.

---

## 2. Quando escrever o `HANDOFF.md`

Escreva (ou atualize) o `HANDOFF.md` na raiz do projeto quando:

1. O contexto da sessão chegar a ~90% da janela. Pare a atividade em curso
   imediatamente e escreva o handoff antes de qualquer outra coisa.
2. O usuário sinalizar o fim da sessão.
3. Um slice/bloco for concluído, antes de iniciar o próximo.
4. O trabalho ficar bloqueado por dependência externa.

O `HANDOFF.md` é um arquivo local de continuidade (gitignored). Não deve conter
segredos nem substituir o histórico do git.

---

## 3. Ciclo de vida do arquivo

1. Ao final da sessão: escrever `HANDOFF.md` na raiz.
2. No início da próxima sessão (CLAUDE.md §7.1): ler o `HANDOFF.md`
   integralmente, rodar `git status` e `git log --oneline -5` para reconciliar
   com o estado real, e apresentar um resumo de 3 a 5 bullets ao usuário.
3. Aguardar a confirmação do usuário antes de prosseguir.
4. Após a confirmação, mover `HANDOFF.md` para
   `docs/handoffs/HANDOFF-<timestamp>.md` (formato sugerido:
   `yyyymmdd-HHMMSS`) e só então começar a trabalhar.

Assim a raiz tem no máximo um handoff ativo por vez, e o histórico fica
preservado em `docs/handoffs/`.

---

## 4. Template

```markdown
# HANDOFF

> Arquivo local (gitignored) para continuidade entre sessões. Próxima sessão:
> seguir CLAUDE.md §7.1 — ler isto, rodar `git status` + `git log --oneline -5`,
> apresentar resumo, aguardar confirmação, e mover este arquivo para
> `docs/handoffs/HANDOFF-<timestamp>.md` antes de começar.

Data: <yyyy-mm-dd>

---

## 1. Estado do repositório

- Branch atual e se o working tree está limpo.
- PRs abertos/mesclados relevantes a esta linha de trabalho.
- O que a `main` (ou a branch) já contém de relevante.
- Estado da suíte: nº de testes, gate de cobertura, E2E (verdes/pulados).

## 2. O que foi concluído (resumo da sessão)

Parágrafo curto com o que mudou nesta sessão.

## 3. PRÓXIMA AÇÃO CONCRETA

A primeira coisa que a próxima sessão deve fazer, em uma ou duas frases.
Incluir branch sugerida quando aplicável.

## 4. Trabalho restante — roteiros

Passos ordenados por dependência. Para features, seguir a ordem das camadas
(domínio em TDD → persistência → IPC → renderer). Listar gotchas críticos.

## 5. Decisões pendentes (precisam do usuário)

Perguntas em aberto que travam ou enviesam a próxima etapa.

## 6. Como verificar (baseline atual)

Comandos para reproduzir o estado verde:
`npm run lint && npm run typecheck && npm run test:coverage && npm run build`
e `npx playwright test`. Notas de validação manual do app empacotado quando
a mudança tocar Electron/main/preload.

## 7. Higiene pendente (opcional)

Itens de limpeza conhecidos que não bloqueiam o trabalho principal.
```

---

## 5. Boas práticas

- Seja específico na "próxima ação concreta": ela deve ser acionável sem
  releitura de todo o código.
- Converta datas relativas em absolutas ("hoje", "semana que vem" -> data).
- Liste gotchas que custaram tempo nesta sessão para a próxima não repetir.
- Garanta que mudanças importantes estão commitadas ou explicitamente listadas
  como "não commitadas" no handoff.
- Sem emojis, conforme as convenções do projeto.
