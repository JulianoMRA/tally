import { useState } from 'react'
import { parseCsv } from '@shared/csv/parse-csv'
import {
  LIMITE_LINHAS_IMPORTACAO,
  type LinhaImportacao,
  type ResultadoImportacao
} from '@shared/ipc/importacao'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Button,
  EmptyState,
  Field,
  FileDropzone,
  Panel,
  Select,
  useToast
} from '../../components/ui'
import { mensagemErro } from '../../lib/mensagem-erro'
import { pluralizar } from '../../lib/pluralizar'
import {
  TEMPLATES,
  validarHeader,
  converterLinhas,
  conteudoDoModelo,
  type ErroDeLinha
} from './templates'
import styles from './importacao.module.css'

type Preview =
  | { kind: 'vazio' }
  | { kind: 'erro-arquivo'; motivo: string }
  | { kind: 'pronto'; nomeArquivo: string; validas: LinhaImportacao[]; erros: ErroDeLinha[] }

const ROTULO_TIPO: Record<string, string> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t.rotulo])
)

export default function ImportarPage() {
  const toast = useToast()
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id)
  const [preview, setPreview] = useState<Preview>({ kind: 'vazio' })
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [resetSeq, setResetSeq] = useState(0)

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]

  function baixarModelo() {
    const blob = new Blob([conteudoDoModelo(template)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = template.arquivo
    a.click()
    URL.revokeObjectURL(url)
  }

  async function aoEscolherArquivo(arquivo: File | undefined) {
    setResultado(null)
    if (!arquivo) {
      setPreview({ kind: 'vazio' })
      return
    }
    try {
      const conteudo = await arquivo.text()
      const { header, linhas } = parseCsv(conteudo)
      validarHeader(template, header)
      // A mesma regra que o schema do IPC aplica, checada aqui para o usuário
      // ver o motivo antes do preview e da conversão de milhares de linhas —
      // e não como uma falha de validação vinda do main.
      if (linhas.length > LIMITE_LINHAS_IMPORTACAO) {
        throw new Error(
          `O arquivo tem ${linhas.length} linhas e o limite por importação é ${LIMITE_LINHAS_IMPORTACAO}. Divida o arquivo e importe em partes.`
        )
      }
      const { validas, erros } = converterLinhas(template, linhas)
      setPreview({ kind: 'pronto', nomeArquivo: arquivo.name, validas, erros })
    } catch (e) {
      setPreview({ kind: 'erro-arquivo', motivo: e instanceof Error ? e.message : String(e) })
    }
  }

  async function importar() {
    if (preview.kind !== 'pronto' || preview.erros.length > 0 || preview.validas.length === 0) {
      return
    }
    setImportando(true)
    try {
      const r = await window.api.dados.importarCsv({ linhas: preview.validas })
      setResultado(r)
      setPreview({ kind: 'vazio' })
      setResetSeq((n) => n + 1)
      toast.show(`${r.inseridos} ${pluralizar('registro', r.inseridos)} importado(s).`, 'success')
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao importar o arquivo.'), 'error')
    } finally {
      setImportando(false)
    }
  }

  return (
    <PageContainer>
      <PageHead
        title="Importar dados"
        subtitle="Migre sua planilha em lote: baixe o modelo do tipo desejado, preencha e importe. Categorias e cartões são referenciados pelo nome e precisam existir antes."
      />
      <div className={styles.body}>
        <Panel title="1. Escolha o tipo e o arquivo">
          <div className={styles.formulario}>
            <Field label="Tipo de dados">
              <Select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value)
                  setPreview({ kind: 'vazio' })
                  setResultado(null)
                  setResetSeq((n) => n + 1)
                }}
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.rotulo}
                  </option>
                ))}
              </Select>
            </Field>

            <div className={styles.acoesArquivo}>
              <Button type="button" variant="secondary" size="sm" onClick={baixarModelo}>
                Baixar modelo ({template.arquivo})
              </Button>
              <FileDropzone
                key={resetSeq}
                accept=".csv,text/csv"
                label="Arquivo CSV"
                nomeAtual={preview.kind === 'pronto' ? preview.nomeArquivo : undefined}
                onArquivo={(arquivo) => void aoEscolherArquivo(arquivo)}
              />
            </div>
            <p className={styles.dica}>
              Colunas esperadas: <code>{template.colunas.join(';')}</code> — datas em AAAA-MM-DD,
              valores como 1.234,56.
            </p>
          </div>
        </Panel>

        <Panel title="2. Confira e importe">
          {preview.kind === 'vazio' && !resultado && (
            <EmptyState
              compacto
              title="Nenhum arquivo carregado."
              description="Escolha um CSV no passo 1 para ver a prévia."
            />
          )}

          {preview.kind === 'erro-arquivo' && (
            <p className={styles.erroArquivo} role="alert">
              {preview.motivo}
            </p>
          )}

          {preview.kind === 'pronto' && (
            <div className={styles.previa}>
              <p className={styles.resumo}>
                <strong>{preview.nomeArquivo}</strong>: {preview.validas.length}{' '}
                {pluralizar('linha', preview.validas.length)} válida(s)
                {preview.erros.length > 0 &&
                  ` e ${preview.erros.length} com erro — corrija o arquivo para importar`}
                .
              </p>

              {preview.erros.length > 0 && (
                <table className={styles.tabelaErros}>
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Problema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.erros.map((e) => (
                      <tr key={e.linha}>
                        <td className="tnum">{e.linha}</td>
                        <td>{e.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className={styles.acoes}>
                <Button
                  type="button"
                  variant="primary"
                  disabled={importando || preview.erros.length > 0 || preview.validas.length === 0}
                  onClick={() => void importar()}
                >
                  {importando
                    ? 'Importando…'
                    : `Importar ${preview.validas.length} ${pluralizar('registro', preview.validas.length)}`}
                </Button>
              </div>
            </div>
          )}

          {resultado && (
            <div className={styles.sucesso}>
              <p>
                {resultado.inseridos} {pluralizar('registro', resultado.inseridos)} importado(s):
              </p>
              <ul>
                {Object.entries(resultado.porTipo).map(([tipo, n]) => (
                  <li key={tipo}>
                    {ROTULO_TIPO[tipo] ?? tipo}: {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </PageContainer>
  )
}
