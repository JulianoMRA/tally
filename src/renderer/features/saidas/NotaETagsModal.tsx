import { useState } from 'react'
import type { DespesaComTags } from '@shared/ipc/despesa'
import { Button, Modal } from '../../components/ui'
import { EditorNotaETags } from './EditorNotaETags'
import styles from './saidas.module.css'

type Props = {
  despesa: DespesaComTags
  onConfirmar: (input: { nota: string | null; tags: string[] }) => Promise<void>
  onCancelar: () => void
}

export function NotaETagsModal({ despesa, onConfirmar, onCancelar }: Props) {
  const [nota, setNota] = useState(despesa.nota ?? '')
  const [tags, setTags] = useState<string[]>(despesa.tags)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

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
      <EditorNotaETags
        nota={nota}
        tags={tags}
        onNotaChange={setNota}
        onTagsChange={setTags}
        idPrefixo="editar-despesa"
      />

      {erro && <p className={styles.erro}>{erro}</p>}
    </Modal>
  )
}
