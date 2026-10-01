import { useState } from 'react'
import type { StatusFatura } from '@domain/entities/fatura'
import { podeRegistrarPagamentoParcial } from '@domain/services/pagamento-parcial'
import { hojeIsoLocal } from '@shared/datas-locais'
import { dataIsoSchema } from '@shared/ipc/date-schema'
import { Button, Field, Input, Modal } from '../../components/ui'
import { ehValorValido, parseCentavos } from '../../lib/dinheiro'
import { formatBRL } from '../../lib/format-brl'
import { formatarMesReferencia } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import styles from './faturas.module.css'

type Props = {
  cartaoNome: string
  mesReferencia: string
  statusFatura: StatusFatura['kind']
  /** O que falta pagar agora (RN-10): é o teto do valor. */
  restanteCentavos: number
  onConfirmar: (input: { valorCentavos: number; dataPagamento: string }) => Promise<void>
  onCancelar: () => void
}

/**
 * Por que o valor digitado não pode ser registrado, ou null quando pode. Campo
 * vazio não acusa nada: o botão fica desabilitado, e reclamar de um campo que
 * a pessoa ainda não tocou seria ruído.
 */
function motivoDoValor(
  texto: string,
  statusFatura: StatusFatura['kind'],
  restanteCentavos: number,
  dataPagamento: string
): string | null {
  if (texto === '') return null
  if (!ehValorValido(texto)) return 'Valor inválido.'
  const permitido = podeRegistrarPagamentoParcial({
    statusFatura,
    restanteCentavos,
    valorCentavos: parseCentavos(texto),
    dataPagamento
  })
  // A data tem o campo dela e a mensagem dela.
  if (permitido.ok || permitido.motivo === 'data-invalida') return null
  return permitido.erro
}

/**
 * Registrar pagamento parcial (RF-FAT-07).
 *
 * O diálogo confere com a MESMA regra do main (`podeRegistrarPagamentoParcial`)
 * antes de habilitar o botão: ação que a tela sabe que vai falhar não é
 * oferecida para falhar depois do clique. O main confere de novo ao gravar,
 * com o estado do banco, e o que ele recusar aparece aqui dentro — o diálogo só
 * fecha quando o registro dá certo.
 */
export function RegistrarPagamentoParcialModal({
  cartaoNome,
  mesReferencia,
  statusFatura,
  restanteCentavos,
  onConfirmar,
  onCancelar
}: Props) {
  const [valorReais, setValorReais] = useState('')
  const [dataPagamento, setDataPagamento] = useState(hojeIsoLocal)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const dataValida = dataIsoSchema.safeParse(dataPagamento).success
  const erroDoValor = motivoDoValor(valorReais, statusFatura, restanteCentavos, dataPagamento)
  const podeRegistrar = valorReais !== '' && erroDoValor === null && dataValida

  async function handleConfirmar() {
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar({ valorCentavos: parseCentavos(valorReais), dataPagamento })
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao registrar o pagamento.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      titulo="Registrar pagamento parcial"
      descricao={
        <>
          <strong>
            {cartaoNome} · {formatarMesReferencia(mesReferencia, { capitalizar: true })}
          </strong>{' '}
          — falta pagar {formatBRL(restanteCentavos)}.
        </>
      }
      onFechar={onCancelar}
      rodape={
        <>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmar}
            disabled={loading || !podeRegistrar}
          >
            {loading ? 'Registrando…' : 'Registrar pagamento'}
          </Button>
        </>
      }
    >
      <div className={styles.modalFields}>
        <Field label="Valor (R$)" error={erroDoValor ?? undefined}>
          <Input
            type="text"
            inputMode="decimal"
            value={valorReais}
            onChange={(e) => setValorReais(e.target.value)}
            placeholder="0,00"
            error={erroDoValor !== null}
            autoFocus
          />
        </Field>

        <Field label="Data do pagamento" error={dataValida ? undefined : 'Data inválida.'}>
          <Input
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            error={!dataValida}
          />
        </Field>
      </div>

      {erro && <p className={styles.erroAcao}>{erro}</p>}
    </Modal>
  )
}
