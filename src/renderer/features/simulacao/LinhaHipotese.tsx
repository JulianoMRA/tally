import { useState } from 'react'
import type { ItemSimulacao, TipoItemSimulacao } from '@domain/entities/simulacao'
import { MAX_DESCRICAO_SIMULACAO, MAX_REPETICOES_SIMULACAO } from '@shared/ipc/simulacao'
import { Button, Input, Select } from '../../components/ui'
import { centavosParaReais, ehValorValido, parseCentavos } from '../../lib/dinheiro'
import { formatBRL } from '../../lib/format-brl'
import styles from './simulacao.module.css'

type Props = {
  item: ItemSimulacao
  onChange: (item: ItemSimulacao) => void
  onRemover: () => void
}

/**
 * Linha editável da lista de hipóteses. Cada campo edita o item no lugar e o
 * total do topo se move junto — é o que faz a tela ser uma calculadora e não um
 * cadastro.
 *
 * **Campo inválido não propaga.** Descrição vazia ou valor a meio de digitar
 * ('12,') ficariam sem forma de ser gravados, e o schema da borda recusaria a
 * simulação inteira. O texto fica no estado local, marcado como erro, e o item
 * só muda quando o que está digitado é válido; sair do campo inválido restaura
 * o valor que estava valendo.
 */
export function LinhaHipotese({ item, onChange, onRemover }: Props) {
  // Só inicialização, sem efeito de sincronia: a lista renderiza cada linha com
  // `key={item.id}`, então trocar de mês ou de item remonta o componente. Um
  // efeito reescrevendo o texto a partir da prop brigaria com a digitação —
  // digitar '1000' vira '1,00' na segunda tecla, e apagar a descrição para
  // reescrevê-la fica impossível.
  const [descricao, setDescricao] = useState(item.descricao)
  const [valor, setValor] = useState(() => centavosParaReais(item.valorCentavos))

  const descricaoValida = descricao.trim().length > 0
  const valorValido = ehValorValido(valor)
  const efeitoCentavos = item.valorCentavos * item.repeticoes

  function mudarDescricao(texto: string) {
    setDescricao(texto)
    if (texto.trim().length > 0) onChange({ ...item, descricao: texto })
  }

  function mudarValor(texto: string) {
    setValor(texto)
    if (ehValorValido(texto)) onChange({ ...item, valorCentavos: parseCentavos(texto) })
  }

  function mudarRepeticoes(texto: string) {
    const n = Number(texto)
    if (!Number.isInteger(n) || n < 1 || n > MAX_REPETICOES_SIMULACAO) return
    onChange({ ...item, repeticoes: n })
  }

  return (
    <tr className={item.ativo ? undefined : styles.linhaDesligada}>
      <td className={styles.colAtivo}>
        <input
          type="checkbox"
          checked={item.ativo}
          onChange={(e) => onChange({ ...item, ativo: e.target.checked })}
          aria-label={`Incluir ${item.descricao} na conta`}
        />
      </td>
      <td>
        <Input
          value={descricao}
          error={!descricaoValida}
          maxLength={MAX_DESCRICAO_SIMULACAO}
          onChange={(e) => mudarDescricao(e.target.value)}
          onBlur={() => !descricaoValida && setDescricao(item.descricao)}
          aria-label="Descrição da hipótese"
        />
      </td>
      <td>
        <Select
          value={item.tipo}
          onChange={(e) => onChange({ ...item, tipo: e.target.value as TipoItemSimulacao })}
          aria-label={`Tipo de ${item.descricao}`}
        >
          <option value="saida">Sai</option>
          <option value="entrada">Entra</option>
        </Select>
      </td>
      <td className={styles.colValor}>
        <Input
          value={valor}
          error={!valorValido}
          inputMode="decimal"
          onChange={(e) => mudarValor(e.target.value)}
          onBlur={() => !valorValido && setValor(centavosParaReais(item.valorCentavos))}
          aria-label={`Valor de ${item.descricao}`}
        />
      </td>
      <td className={styles.colRepeticoes}>
        <Input
          type="number"
          min={1}
          max={MAX_REPETICOES_SIMULACAO}
          value={item.repeticoes}
          onChange={(e) => mudarRepeticoes(e.target.value)}
          aria-label={`Repetições de ${item.descricao}`}
        />
      </td>
      <td className={`${styles.colEfeito} tnum`}>
        <span className={item.tipo === 'entrada' ? styles.efeitoEntrada : styles.efeitoSaida}>
          {item.tipo === 'entrada' ? '+' : '-'}
          {formatBRL(efeitoCentavos)}
        </span>
      </td>
      <td className={styles.colAcao}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemover}
          aria-label={`Remover ${item.descricao}`}
        >
          Remover
        </Button>
      </td>
    </tr>
  )
}
