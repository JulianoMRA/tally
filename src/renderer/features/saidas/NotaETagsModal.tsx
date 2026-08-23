import { useState, type KeyboardEvent } from 'react'
import type { DespesaComTags } from '@shared/ipc/despesa'
import { Button, Modal } from '../../components/ui'
import styles from './saidas.module.css'

type Props = {
  despesa: DespesaComTags
  onConfirmar: (input: { nota: string | null; tags: string[] }) => Promise<void>
  onCancelar: () => void
}

export function NotaETagsModal({ despesa, onConfirmar, onCancelar }: Props) {
  const [nota, setNota] = useState(despesa.nota ?? '')
  const [tags, setTags] = useState<string[]>(despesa.tags)
  const [entradaTag, setEntradaTag] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function adicionarTag() {
    const limpo = entradaTag.trim()
    if (limpo.length === 0) return
    const jaExiste = tags.some((t) => t.toLowerCase() === limpo.toLowerCase())
    if (!jaExiste) setTags([...tags, limpo])
    setEntradaTag('')
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      adicionarTag()
    }
  }

  function removerTag(alvo: string) {
    setTags(tags.filter((t) => t !== alvo))
  }

  async function confirmar() {
    setSalvando(true)
    setErro(null)
    try {
      await onConfirmar({ nota: nota.trim().length > 0 ? nota : null, tags })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    // Sem `fecharNoOverlay`: a nota é texto livre e as tags recém-digitadas ainda
    // não foram salvas, então o clique fora descartaria tudo sem aviso. Era o
    // comportamento antigo deste modal, e o único dos seis que divergia.
    <Modal
      titulo="Nota e tags"
      descricao={despesa.descricao}
      onFechar={onCancelar}
      largura="ampla"
      rodape={
        <>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={confirmar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <label className={styles.modalLabel} htmlFor="nota-despesa">
        Nota
      </label>
      <textarea
        id="nota-despesa"
        className={styles.notaTextarea}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Anotação livre (ex: reembolsável pelo trabalho)"
        rows={3}
      />

      <label className={styles.modalLabel} htmlFor="entrada-tag">
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
          id="entrada-tag"
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

      {erro && <p className={styles.erro}>{erro}</p>}
    </Modal>
  )
}
