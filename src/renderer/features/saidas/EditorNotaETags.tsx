import { useState, type KeyboardEvent } from 'react'
import { Button } from '../../components/ui'
import styles from './saidas.module.css'

type Props = {
  nota: string
  tags: string[]
  onNotaChange: (nota: string) => void
  onTagsChange: (tags: string[]) => void
  /**
   * Prefixo dos ids dos campos. As duas instâncias — modal de edição e
   * cadastro — podem coexistir na árvore, e `id` duplicado quebra o
   * `<label for>`: o clique no rótulo focaria o campo da outra.
   */
  idPrefixo: string
}

/**
 * Nota livre e chips de tag (RF-DES-13), sem estado próprio de persistência.
 *
 * Nasceu dentro do `NotaETagsModal` e saiu de lá quando o cadastro passou a
 * oferecer os mesmos campos: manter duas cópias faria a regra de "tag repetida
 * não entra" divergir entre editar e criar, que é o tipo de divergência que
 * este projeto já pagou em modais e tabelas.
 */
export function EditorNotaETags({ nota, tags, onNotaChange, onTagsChange, idPrefixo }: Props) {
  const [entradaTag, setEntradaTag] = useState('')

  function adicionarTag() {
    const limpo = entradaTag.trim()
    if (limpo.length === 0) return
    // Case-insensitive: "Trabalho" e "trabalho" são a mesma tag no banco
    // (`upsertPorNome`), então aceitar as duas aqui criaria um chip que some
    // ao salvar.
    const jaExiste = tags.some((t) => t.toLowerCase() === limpo.toLowerCase())
    if (!jaExiste) onTagsChange([...tags, limpo])
    setEntradaTag('')
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      // Enter dentro de um <form> submeteria o formulário. No cadastro isso
      // registraria a despesa ao tentar adicionar uma tag.
      e.preventDefault()
      adicionarTag()
    }
  }

  function removerTag(alvo: string) {
    onTagsChange(tags.filter((t) => t !== alvo))
  }

  const idNota = `${idPrefixo}-nota`
  const idTag = `${idPrefixo}-tag`

  return (
    <>
      <label className={styles.modalLabel} htmlFor={idNota}>
        Nota
      </label>
      <textarea
        id={idNota}
        className={styles.notaTextarea}
        value={nota}
        onChange={(e) => onNotaChange(e.target.value)}
        placeholder="Anotação livre (ex: reembolsável pelo trabalho)"
        rows={3}
      />

      <label className={styles.modalLabel} htmlFor={idTag}>
        Tags
      </label>
      <div className={styles.tagChips}>
        {tags.map((t) => (
          <span key={t} className={styles.tagChip}>
            {t}
            <button
              type="button"
              className={styles.tagChipX}
              aria-label={`Remover tag ${t}`}
              onClick={() => removerTag(t)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className={styles.tagEntrada}>
        <input
          id={idTag}
          className={styles.tagInput}
          value={entradaTag}
          onChange={(e) => setEntradaTag(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Digite e pressione Enter"
          aria-label="Nova tag"
        />
        <Button type="button" variant="secondary" size="sm" onClick={adicionarTag}>
          Adicionar
        </Button>
      </div>
    </>
  )
}
