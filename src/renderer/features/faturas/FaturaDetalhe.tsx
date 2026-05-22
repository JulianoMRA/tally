import { useState } from 'react'
import type { Fatura } from '@domain/entities/fatura'
import type { FaturaDetalhada } from '@shared/ipc/fatura'
import { useCicloFatura } from './hooks/use-faturas'
import { AdiantarParcelasModal } from './AdiantarParcelasModal'
import {
  Badge,
  Button,
  ConfirmDialog,
  Panel,
  EmptyState,
  Field,
  Input,
  useToast
} from '../../components/ui'
import styles from './faturas.module.css'

type DialogoConfirma =
  | { tipo: 'fechar' }
  | { tipo: 'reabrir' }
  | { tipo: 'excluir'; despesaId: number }

type Props = {
  detalhe: FaturaDetalhada
  cartaoNome: string
  cartaoCor?: string
  onVoltar: () => void
  onFaturaAtualizada: (fatura: Fatura) => void
  onDetalheAtualizado: (detalhe: FaturaDetalhada) => void
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusVariant(kind: string): 'open' | 'closed' | 'paid' {
  if (kind === 'Aberta') return 'open'
  if (kind === 'Fechada') return 'closed'
  return 'paid'
}

function dataHoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FaturaDetalhe({
  detalhe,
  cartaoNome,
  cartaoCor,
  onVoltar,
  onFaturaAtualizada,
  onDetalheAtualizado
}: Props) {
  const { fatura, parcelas, totalCentavos } = detalhe
  const kind = fatura.status.kind

  const [modoPagar, setModoPagar] = useState(false)
  const [dataPagamento, setDataPagamento] = useState(dataHoje)
  const [modoAdiantar, setModoAdiantar] = useState(false)
  const [dialogo, setDialogo] = useState<DialogoConfirma | null>(null)
  const toast = useToast()

  const ciclo = useCicloFatura(onFaturaAtualizada)

  async function recarregarDetalhe() {
    const atualizada = await window.api.fatura.detalharComParcelas(fatura.id)
    if (atualizada) {
      onFaturaAtualizada(atualizada.fatura)
      onDetalheAtualizado(atualizada)
    }
  }

  async function handleAdiantar(despesaId: number, quantidade: number) {
    await window.api.despesa.adiantarParcelas({ despesaId, quantidade, faturaDestinoId: fatura.id })
    setModoAdiantar(false)
    await recarregarDetalhe()
  }

  async function confirmarExcluirDespesa(despesaId: number) {
    try {
      await window.api.despesa.excluir({ despesaId })
      toast.show('Despesa excluída.', 'success')
      await recarregarDetalhe()
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Erro ao excluir despesa.', 'error')
    } finally {
      setDialogo(null)
    }
  }

  function handlePagarConfirmar() {
    ciclo.pagar(fatura.id, dataPagamento).then(() => setModoPagar(false))
  }

  return (
    <div className={styles.detalhe}>
      <div className={styles.detalheHeader}>
        <div className={styles.detalheTitle}>
          {cartaoCor && <span className={styles.cardChip} style={{ background: cartaoCor }} />}
          <div>
            <h2 className={styles.detalheTitleText}>
              {cartaoNome} · {fatura.mesReferencia}
            </h2>
            <p className={styles.detalheMeta}>
              Fecha {fatura.dataFechamento} · Vence {fatura.dataVencimento}
            </p>
          </div>
        </div>
        <div className={styles.detalheActions}>
          <Badge variant={statusVariant(kind)} />
          <Button variant="ghost" size="sm" onClick={onVoltar}>
            ← Voltar
          </Button>
        </div>
      </div>

      <div className={styles.cicloActions}>
        {kind === 'Aberta' && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialogo({ tipo: 'fechar' })}
              disabled={ciclo.loading}
            >
              Fechar fatura
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModoAdiantar(true)}
              disabled={ciclo.loading}
            >
              Adiantar parcelas
            </Button>
          </>
        )}
        {kind === 'Fechada' && !modoPagar && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setModoPagar(true)}
            disabled={ciclo.loading}
          >
            Marcar como paga
          </Button>
        )}
        {kind === 'Fechada' && modoPagar && (
          <div className={styles.pagarForm}>
            <Field label="Data de pagamento">
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePagarConfirmar}
              disabled={ciclo.loading}
            >
              Confirmar pagamento
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModoPagar(false)}
              disabled={ciclo.loading}
            >
              Cancelar
            </Button>
          </div>
        )}
        {kind === 'Paga' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogo({ tipo: 'reabrir' })}
            disabled={ciclo.loading}
          >
            Reabrir fatura
          </Button>
        )}
        {ciclo.erro && <p className={styles.erroAcao}>{ciclo.erro}</p>}
      </div>

      {modoAdiantar && (
        <AdiantarParcelasModal
          faturaDestinoId={fatura.id}
          onConfirmar={handleAdiantar}
          onCancelar={() => setModoAdiantar(false)}
        />
      )}

      <Panel
        title="Parcelas"
        meta={`${parcelas.length} lançamento${parcelas.length !== 1 ? 's' : ''}`}
        flush
      >
        {parcelas.length === 0 ? (
          <EmptyState title="Nenhuma parcela nesta fatura." />
        ) : (
          <>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Parcela</th>
                  <th>Data</th>
                  <th className={styles.colValor}>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.colId}>{p.id}</td>
                    <td className="mono">
                      {p.numero}/{p.total ?? '?'}
                    </td>
                    <td>{p.dataReferencia}</td>
                    <td className={`${styles.colValor} tnum`}>{formatBRL(p.valorCentavos)}</td>
                    <td>
                      <Badge variant={p.status === 'Paga' ? 'paid' : 'pending'} />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialogo({ tipo: 'excluir', despesaId: p.despesaId })}
                        disabled={p.status === 'Paga'}
                        title={
                          p.status === 'Paga'
                            ? 'Não é possível excluir uma despesa com parcela paga'
                            : 'Excluir despesa inteira'
                        }
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.totaisFooter}>
              <div className={`${styles.totalLinha} ${styles.totalLiquidoLinha}`}>
                <span className={styles.totalLabel}>Total</span>
                <span className={`${styles.totalLiquidoValor} tnum`}>
                  {formatBRL(totalCentavos)}
                </span>
              </div>
            </div>
          </>
        )}
      </Panel>

      {dialogo?.tipo === 'fechar' && (
        <ConfirmDialog
          title="Fechar fatura?"
          body="Após fechada, novas parcelas só entram via adiantamento explícito."
          confirmText="Fechar"
          onConfirm={() => {
            ciclo.fechar(fatura.id)
            setDialogo(null)
          }}
          onCancel={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'reabrir' && (
        <ConfirmDialog
          title="Reabrir fatura?"
          body="O status voltará para Aberta. A data de pagamento será apagada."
          confirmText="Reabrir"
          onConfirm={() => {
            ciclo.reabrir(fatura.id)
            setDialogo(null)
          }}
          onCancel={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'excluir' && (
        <ConfirmDialog
          title="Excluir despesa?"
          body="A despesa e TODAS as suas parcelas pendentes serão removidas. Esta ação é irreversível."
          confirmText="Excluir"
          confirmVariant="danger"
          onConfirm={() => confirmarExcluirDespesa(dialogo.despesaId)}
          onCancel={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
