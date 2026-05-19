import { useState } from 'react'
import type { StatusAjuda } from '@domain/entities/ajuda'
import type { AjudaComContexto } from '@shared/ipc/ajuda'
import { PageHead } from '../../components/layout/PageHead'
import { Button, EmptyState } from '../../components/ui'
import { useAjudasAgrupadas } from './hooks/use-ajudas'
import { MarcarRecebidaModal } from './MarcarRecebidaModal'
import styles from './ajudas.module.css'

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AjudasPage() {
  const [status, setStatus] = useState<StatusAjuda>('Pendente')
  const { grupos, loading, erro, recarregar } = useAjudasAgrupadas(status)
  const [alvoRecebida, setAlvoRecebida] = useState<AjudaComContexto | null>(null)
  const [acaoErro, setAcaoErro] = useState<string | null>(null)

  async function handleMarcarRecebida(dataRecebimento: string) {
    if (!alvoRecebida) return
    await window.api.ajuda.marcarRecebida({ ajudaId: alvoRecebida.id, dataRecebimento })
    setAlvoRecebida(null)
    await recarregar()
  }

  async function handleExcluir(ajuda: AjudaComContexto) {
    const ok = window.confirm(
      `Excluir ajuda de ${formatBRL(ajuda.valorCentavos)} em "${ajuda.descricaoDespesa}"?`
    )
    if (!ok) return
    setAcaoErro(null)
    try {
      await window.api.ajuda.excluir({ ajudaId: ajuda.id })
      await recarregar()
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : 'Erro ao excluir.')
    }
  }

  return (
    <div>
      <PageHead
        title="A receber por pessoa"
        subtitle="Ajudas vinculadas a parcelas. Não conta como entrada — abate do líquido da fatura."
      />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <Button
            variant={status === 'Pendente' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatus('Pendente')}
          >
            Pendentes
          </Button>
          <Button
            variant={status === 'Recebida' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatus('Recebida')}
          >
            Recebidas
          </Button>
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}
        {acaoErro && <p className={styles.erro}>{acaoErro}</p>}

        {loading ? (
          <EmptyState title="Carregando…" />
        ) : grupos.length === 0 ? (
          <EmptyState
            title={
              status === 'Pendente' ? 'Nenhuma ajuda pendente.' : 'Nenhuma ajuda recebida ainda.'
            }
          />
        ) : (
          <div className={styles.grupos}>
            {grupos.map((grupo) => {
              const totalDisplay =
                status === 'Pendente'
                  ? grupo.totalPendentesCentavos
                  : grupo.totalCentavos - grupo.totalPendentesCentavos
              return (
                <div key={grupo.contribuidor.id} className={styles.grupo}>
                  <div className={styles.grupoHeader}>
                    <div className={styles.avatar}>
                      {grupo.contribuidor.nome.slice(0, 1).toUpperCase()}
                    </div>
                    <div className={styles.grupoTitle}>
                      <span className={styles.nome}>{grupo.contribuidor.nome}</span>
                      <span className={styles.meta}>
                        {grupo.ajudas.length} ajuda{grupo.ajudas.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className={styles.totais}>
                      <span className={styles.totalLabel}>
                        {status === 'Pendente' ? 'Pendente' : 'Recebido'}
                      </span>
                      <span className={styles.totalValor}>{formatBRL(totalDisplay)}</span>
                    </div>
                  </div>

                  <table className={styles.tabela}>
                    <thead>
                      <tr>
                        <th>Despesa</th>
                        <th>Mês ref.</th>
                        <th className={styles.colValor}>Valor</th>
                        <th className={styles.colAcoes}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.ajudas.map((a) => (
                        <tr key={a.id}>
                          <td>{a.descricaoDespesa}</td>
                          <td className="mono">
                            {a.mesReferencia ?? a.dataReferenciaParcela.slice(0, 7)}
                          </td>
                          <td className={`${styles.colValor} tnum`}>
                            {formatBRL(a.valorCentavos)}
                          </td>
                          <td className={styles.colAcoes}>
                            {a.status === 'Pendente' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => setAlvoRecebida(a)}
                                >
                                  Recebida
                                </Button>{' '}
                                <Button size="sm" variant="ghost" onClick={() => handleExcluir(a)}>
                                  Excluir
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className={styles.recebidaInfo}>
                                  Recebida em {a.dataRecebimento}
                                </span>{' '}
                                <Button size="sm" variant="ghost" onClick={() => handleExcluir(a)}>
                                  Excluir
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}

        {alvoRecebida && (
          <MarcarRecebidaModal
            descricao={alvoRecebida.descricaoDespesa}
            valorReais={formatBRL(alvoRecebida.valorCentavos)}
            onConfirmar={handleMarcarRecebida}
            onCancelar={() => setAlvoRecebida(null)}
          />
        )}
      </div>
    </div>
  )
}
