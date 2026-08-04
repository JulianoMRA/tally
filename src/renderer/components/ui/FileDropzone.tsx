import { useRef, useState } from 'react'
import styles from './file-dropzone.module.css'

interface FileDropzoneProps {
  onArquivo: (arquivo: File | undefined) => void
  accept?: string
  label: string
  /** Nome do arquivo já escolhido, para exibir no lugar da instrução. */
  nomeAtual?: string
}

/**
 * Área de upload com arrastar-e-soltar. Substitui o `<input type="file">`
 * nativo, que era o outro controle do app sem tratamento visual — aparecia
 * como "Escolher arquivo | Nenhum arquivo escolhido" no meio de um formulário
 * inteiramente estilizado.
 *
 * O input segue no DOM, só que visualmente escondido: é ele quem carrega a
 * semântica e o suporte a teclado, e é nele que o Playwright faz
 * `setInputFiles`.
 */
export function FileDropzone({ onArquivo, accept, label, nomeAtual }: FileDropzoneProps) {
  const [arrastando, setArrastando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function aoSoltar(e: React.DragEvent) {
    e.preventDefault()
    setArrastando(false)
    const arquivo = e.dataTransfer.files?.[0]
    if (!arquivo) return
    // Reflete no input para que o formulário e o `value=""` de reset continuem
    // funcionando como antes.
    const dt = new DataTransfer()
    dt.items.add(arquivo)
    if (inputRef.current) inputRef.current.files = dt.files
    onArquivo(arquivo)
  }

  return (
    <div
      className={`${styles.zona} ${arrastando ? styles.arrastando : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setArrastando(true)
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.input}
        aria-label={label}
        onChange={(e) => onArquivo(e.target.files?.[0])}
      />
      <span className={styles.texto}>
        {nomeAtual ? (
          <strong className={styles.arquivo}>{nomeAtual}</strong>
        ) : (
          <>
            Arraste o arquivo aqui ou <span className={styles.acao}>clique para escolher</span>
          </>
        )}
      </span>
    </div>
  )
}
