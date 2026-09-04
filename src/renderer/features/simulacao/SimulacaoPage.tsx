import { useEffect, useMemo, useState } from 'react'
import type { ItemSimulacao, ModoBaseSimulacao } from '@domain/entities/simulacao'
import { calcularSimulacao } from '@domain/services/calcular-simulacao'
import { MAX_DESCRICAO_SIMULACAO, MAX_ITENS_SIMULACAO } from '@shared/ipc/simulacao'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Panel,
  SegmentedControl,
  Select,
  SeletorMes,
  Table,
  type OpcaoSegmentada
} from '../../components/ui'
import { centavosParaReais, ehValorValido, parseCentavos } from '../../lib/dinheiro'
import { formatBRL } from '../../lib/format-brl'
import { formatarMesCurto } from '../../lib/formatar-mes'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { useVisaoMensal } from '../visao-mensal/hooks/use-visao-mensal'
import { LinhaHipotese } from './LinhaHipotese'
import { SaldoSimuladoHero } from './SaldoSimuladoHero'
import { useSimulacao } from './hooks/use-simulacao'
import styles from './simulacao.module.css'

const MODOS: readonly OpcaoSegmentada<ModoBaseSimulacao>[] = [
  { valor: 'mes', rotulo: 'Saldo do mês' },
  { valor: 'manual', rotulo: 'Valor que eu digito' }
]

/** `randomUUID` não existe em todo ambiente de teste; o id só precisa ser único no mês. */
function novoId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Campo do valor digitado da base. Estado local pelo mesmo motivo da
 * `LinhaHipotese`: '20,' a meio de digitar não é um número, e propagar a cada
 * tecla gravaria lixo.
 */
function CampoBaseManual({
  valorCentavos,
  onChange
}: {
  valorCentavos: number
  onChange: (centavos: number) => void
}) {
  const [texto, setTexto] = useState(() => centavosParaReais(valorCentavos))

  // Reformata só quando o valor vindo de fora (troca de mês) discorda do que
  // está escrito. Reformatar sempre brigaria com a digitação: '1000' viraria
  // '1,00' na segunda tecla, porque o '1' já teria virado 100 centavos.
  useEffect(() => {
    setTexto((atual) =>
      ehValorValido(atual) && parseCentavos(atual) === valorCentavos
        ? atual
        : centavosParaReais(valorCentavos)
    )
  }, [valorCentavos])

  const valido = ehValorValido(texto)

  return (
    <Field label="Tenho na conta" error={valido ? undefined : 'Valor inválido'}>
      <Input
        value={texto}
        error={!valido}
        inputMode="decimal"
        onChange={(e) => {
          setTexto(e.target.value)
          if (ehValorValido(e.target.value)) onChange(parseCentavos(e.target.value))
        }}
        onBlur={() => !valido && setTexto(centavosParaReais(valorCentavos))}
      />
    </Field>
  )
}

/**
 * Simulação (RF-SIM): calculadora de hipóteses sobre o saldo de um mês.
 *
 * A tela não escreve nada no banco. Os únicos canais que ela usa são
 * `simulacao:obter` e `simulacao:salvar`, que gravam num JSON próprio, mais o
 * `visao-mensal:detalhar` — de leitura — para saber a sobra projetada do mês
 * quando a base é o saldo. Nenhuma despesa, parcela, fatura ou recebimento é
 * criada, alterada ou apagada aqui.
 */
export default function SimulacaoPage() {
  const [mes, setMes] = useState(mesAtualReferencia())
  const { simulacao, atualizar, carregando, erro } = useSimulacao(mes)
  const { detalhe, loading: carregandoMes } = useVisaoMensal(mes)
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)

  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState<ItemSimulacao['tipo']>('saida')
  const [repeticoes, setRepeticoes] = useState('1')

  const saldoDoMesCentavos = detalhe?.totais.saldoProjetadoCentavos ?? 0
  const baseCentavos =
    simulacao.base.modo === 'mes' ? saldoDoMesCentavos : simulacao.base.valorManualCentavos

  const resultado = useMemo(
    () => calcularSimulacao(baseCentavos, simulacao.itens),
    [baseCentavos, simulacao.itens]
  )

  const ativos = simulacao.itens.filter((i) => i.ativo).length
  const desligados = simulacao.itens.length - ativos
  const cheio = simulacao.itens.length >= MAX_ITENS_SIMULACAO
  const podeAdicionar = descricao.trim().length > 0 && ehValorValido(valor) && !cheio

  function definirModo(modo: ModoBaseSimulacao) {
    atualizar({ ...simulacao, base: { ...simulacao.base, modo } })
  }

  function definirValorManual(valorManualCentavos: number) {
    atualizar({ ...simulacao, base: { ...simulacao.base, valorManualCentavos } })
  }

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!podeAdicionar) return

    const item: ItemSimulacao = {
      id: novoId(),
      descricao: descricao.trim(),
      valorCentavos: parseCentavos(valor),
      repeticoes: Number(repeticoes) || 1,
      tipo,
      ativo: true
    }

    atualizar({ ...simulacao, itens: [...simulacao.itens, item] })
    setDescricao('')
    setValor('')
    setRepeticoes('1')
  }

  function alterarItem(item: ItemSimulacao) {
    atualizar({
      ...simulacao,
      itens: simulacao.itens.map((i) => (i.id === item.id ? item : i))
    })
  }

  function removerItem(id: string) {
    atualizar({ ...simulacao, itens: simulacao.itens.filter((i) => i.id !== id) })
  }

  function limpar() {
    atualizar({ base: { modo: 'mes', valorManualCentavos: 0 }, itens: [] })
    setConfirmandoLimpeza(false)
  }

  const origemBase =
    simulacao.base.modo === 'mes'
      ? `sobra projetada de ${formatarMesCurto(mes)}`
      : 'valor informado por você'

  return (
    <PageContainer>
      <PageHead title="Simulação" />

      <div className={styles.header}>
        <SeletorMes valor={mes} onChange={setMes} label="Mês" />
        <span className={styles.headerSubtitulo}>
          Rascunho de hipóteses. Nada aqui vira despesa, renda ou fatura.
        </span>
        <span className={styles.headerAcoes}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmandoLimpeza(true)}
            disabled={simulacao.itens.length === 0}
          >
            Limpar simulação
          </Button>
        </span>
      </div>

      {erro && <p className={styles.erro}>{erro}</p>}

      {carregando ? (
        <EmptyState title="Carregando…" />
      ) : (
        <div className={styles.layout}>
          <SaldoSimuladoHero
            resultado={resultado}
            qtdItensAtivos={ativos}
            qtdItensDesligados={desligados}
            origemBase={origemBase}
          />

          <Panel title="Ponto de partida">
            <div className={styles.base}>
              <SegmentedControl
                opcoes={MODOS}
                valor={simulacao.base.modo}
                onChange={definirModo}
                label="De onde a simulação parte"
              />

              {simulacao.base.modo === 'mes' ? (
                <p className={styles.baseNota}>
                  <strong className="tnum">
                    {carregandoMes ? '…' : formatBRL(saldoDoMesCentavos)}
                  </strong>{' '}
                  é a sobra projetada de {formatarMesCurto(mes)} — o mesmo número da Visão mensal,
                  com o que já está cadastrado.
                </p>
              ) : (
                <>
                  <CampoBaseManual
                    valorCentavos={simulacao.base.valorManualCentavos}
                    onChange={definirValorManual}
                  />
                  <p className={styles.baseNota}>
                    O app não sabe quanto há na sua conta hoje — ele acompanha o fluxo do mês, não o
                    saldo bancário. Por isso este número é digitado.
                  </p>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Hipóteses" meta={`${simulacao.itens.length}/${MAX_ITENS_SIMULACAO}`}>
            {/* Nome acessível no formulário: sem ele, "Descrição" resolveria
                tanto aqui quanto no campo de cada linha da lista. */}
            <form className={styles.formulario} aria-label="Nova hipótese" onSubmit={adicionar}>
              <Field label="Descrição" required>
                <Input
                  value={descricao}
                  maxLength={MAX_DESCRICAO_SIMULACAO}
                  placeholder="Fim de semana"
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as ItemSimulacao['tipo'])}
                >
                  <option value="saida">Sai</option>
                  <option value="entrada">Entra</option>
                </Select>
              </Field>
              <Field label="Valor" required>
                <Input
                  value={valor}
                  inputMode="decimal"
                  placeholder="100,00"
                  error={valor.length > 0 && !ehValorValido(valor)}
                  onChange={(e) => setValor(e.target.value)}
                />
              </Field>
              <Field label="Vezes no mês" hint="4 fins de semana, 20 almoços">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={repeticoes}
                  onChange={(e) => setRepeticoes(e.target.value)}
                />
              </Field>
              <Button type="submit" variant="primary" disabled={!podeAdicionar}>
                Adicionar
              </Button>
            </form>

            {cheio && (
              <p className={styles.aviso}>
                Limite de {MAX_ITENS_SIMULACAO} hipóteses no mês. Remova alguma para adicionar
                outra.
              </p>
            )}

            {simulacao.itens.length === 0 ? (
              <EmptyState
                title="Nenhuma hipótese ainda"
                description="Adicione um gasto ou uma entrada que você está considerando e veja o saldo do mês reagir."
                compacto
              />
            ) : (
              <Table densidade="compacta">
                <thead>
                  <tr>
                    <th scope="col" className={styles.colAtivo}>
                      <span className={styles.somenteLeitor}>Na conta</span>
                    </th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Tipo</th>
                    <th scope="col" className={styles.colValor}>
                      Valor
                    </th>
                    <th scope="col" className={styles.colRepeticoes}>
                      Vezes
                    </th>
                    <th scope="col" className={styles.colEfeito}>
                      Efeito
                    </th>
                    <th scope="col" className={styles.colAcao}>
                      <span className={styles.somenteLeitor}>Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {simulacao.itens.map((item) => (
                    <LinhaHipotese
                      key={item.id}
                      item={item}
                      onChange={alterarItem}
                      onRemover={() => removerItem(item.id)}
                    />
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      {confirmandoLimpeza && (
        <ConfirmDialog
          title="Limpar a simulação deste mês?"
          body="As hipóteses deste mês serão apagadas e o ponto de partida volta ao saldo do mês. Nenhum dado real é afetado."
          confirmText="Limpar"
          confirmVariant="danger"
          onConfirm={limpar}
          onCancel={() => setConfirmandoLimpeza(false)}
        />
      )}
    </PageContainer>
  )
}
