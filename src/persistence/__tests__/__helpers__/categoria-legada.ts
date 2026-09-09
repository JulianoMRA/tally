import type { Database } from '../../database'

/**
 * Insere uma categoria funcionando dos DOIS lados da migration 0014.
 *
 * A 0014 removeu `categoria.tipo`. Os testes de migration inserem ora num
 * schema antigo (onde a coluna existe e e NOT NULL), ora no schema final (onde
 * ela nao existe) — o mesmo helper e chamado nos dois casos, e assumir um dos
 * lados quebra o outro.
 *
 * Descobrir pelo `PRAGMA table_info` em vez de duplicar o helper mantem o teste
 * legivel e, mais importante, faz o proximo `tipo`-like nao precisar de outra
 * duplicacao.
 */
export function inserirCategoriaEmQualquerSchema(
  db: Database,
  id: number,
  nome: string,
  cor: string
): void {
  const colunas = db.prepare('PRAGMA table_info(categoria)').all() as { name: string }[]
  const temTipo = colunas.some((c) => c.name === 'tipo')

  if (temTipo) {
    db.prepare("INSERT INTO categoria (id, nome, tipo, cor) VALUES (?, ?, 'Despesa', ?)").run(
      id,
      nome,
      cor
    )
    return
  }
  db.prepare('INSERT INTO categoria (id, nome, cor) VALUES (?, ?, ?)').run(id, nome, cor)
}
