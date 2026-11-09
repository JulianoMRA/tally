import { useId } from 'react'
import { indiceDaTecla } from '../../lib/navegacao-por-setas'
import styles from './color-picker.module.css'

/**
 * Uma cor sugerida. As listas ficam em TS, e não no CSS, porque são **dado** —
 * o valor é gravado no banco e aplicado via `style` inline, do mesmo jeito que
 * os chips de cor já faziam. Isso também mantém o guard `cores-tokenizadas`
 * satisfeito, já que nenhum hex entra em CSS de feature.
 */
export interface SugestaoDeCor {
  hex: string
  nome: string
}

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  label: string
  /** Cartão e categoria têm listas próprias: a cor do cartão é a do banco. */
  sugestoes: readonly SugestaoDeCor[]
  id?: string
}

/**
 * Escolha de cor em swatches, com entrada livre ao lado. Substitui o
 * `<input type="color">` cru, que era o único controle do app sem tratamento
 * visual e vinha com `#000000` — uma cor que não existe na paleta.
 */
export function ColorPicker({ value, onChange, label, sugestoes, id }: ColorPickerProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const escolhida = sugestoes.findIndex((cor) => cor.hex === value.toLowerCase())
  // Com a cor livre nenhum swatch está marcado, e o grupo precisa de uma parada
  // de Tab mesmo assim: a primeira, como manda o padrão de radiogroup. Sem ela,
  // o grupo inteiro sumia do teclado.
  const paradaDeTab = escolhida === -1 ? 0 : escolhida

  // Roving tabindex, como no SegmentedControl: o grupo é uma parada de Tab, e as
  // setas andam e escolhem. Andam a partir do swatch focado, e não do escolhido:
  // com a cor livre, o foco entra no primeiro, que não está marcado.
  function navegar(e: React.KeyboardEvent<HTMLDivElement>) {
    const swatches = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    const atual = swatches.indexOf(e.target as HTMLButtonElement)
    const proximo = indiceDaTecla(e.key, atual, swatches.length)
    if (atual === -1 || proximo === null) return
    e.preventDefault()

    onChange(sugestoes[proximo].hex)
    swatches[proximo].focus()
  }

  return (
    <div className={styles.root}>
      <div className={styles.swatches} role="radiogroup" aria-label={label} onKeyDown={navegar}>
        {sugestoes.map((cor, indice) => {
          const ativa = indice === escolhida
          return (
            <button
              key={cor.hex}
              type="button"
              role="radio"
              aria-checked={ativa}
              aria-label={cor.nome}
              title={cor.nome}
              tabIndex={indice === paradaDeTab ? 0 : -1}
              className={`${styles.swatch} ${ativa ? styles.ativa : ''}`}
              style={{ background: cor.hex }}
              onClick={() => onChange(cor.hex)}
            />
          )
        })}
      </div>

      <label className={styles.livre} htmlFor={inputId}>
        <input
          id={inputId}
          type="color"
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className={styles.livreTexto}>Outra…</span>
      </label>
    </div>
  )
}
