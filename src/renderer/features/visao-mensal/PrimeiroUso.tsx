import { useNavigate } from 'react-router-dom'
import { Button, Panel } from '../../components/ui'
import styles from './visao-mensal.module.css'

const PASSOS = [
  {
    para: '/cartoes',
    titulo: 'Cadastre um cartão',
    texto:
      'Com o dia de fechamento e o de vencimento — é o que decide em qual fatura cada compra cai.'
  },
  {
    para: '/categorias',
    titulo: 'Crie suas categorias',
    texto: 'Mercado, transporte, casa. Toda despesa precisa de uma, e elas alimentam os relatórios.'
  },
  {
    para: '/saidas',
    titulo: 'Registre a primeira despesa',
    texto: 'A fatura do mês aparece aqui automaticamente, junto do saldo.'
  }
] as const

/**
 * Primeiro uso. Com a base vazia a Visão mensal mostrava R$ 0,00 em tudo e
 * "Nenhuma fatura neste mês", sem dizer por onde começar — e o formulário de
 * Saídas convidava a cadastrar uma despesa com o select de Cartão vazio,
 * falhando só no submit.
 */
export function PrimeiroUso() {
  const navigate = useNavigate()

  return (
    <Panel title="Comece por aqui" meta="3 passos">
      <ol className={styles.passos}>
        {PASSOS.map((passo, i) => (
          <li key={passo.para} className={styles.passo}>
            <span className={styles.passoNumero} aria-hidden="true">
              {i + 1}
            </span>
            <div>
              {/* Botão, e não link: o nome acessível de um <a> aqui casaria por
                  substring com o link homônimo da sidebar, e qualquer
                  `getByRole('link', { name: 'Categorias' })` viraria ambíguo. */}
              <Button variant="ghost" size="sm" onClick={() => navigate(passo.para)}>
                {passo.titulo}
              </Button>
              <p className={styles.passoTexto}>{passo.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
