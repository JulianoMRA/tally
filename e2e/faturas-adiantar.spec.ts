import { test, expect } from './fixtures/electron-app'
import {
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  focarCartao,
  irPara
} from './fixtures/navegacao'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'

/**
 * Adiantar parcelas pela tela de Faturas (RN-03). Não havia nenhum spec desse
 * fluxo.
 *
 * O destino padrão é a fatura em tela: o modal a excluía das opções, e quem
 * via a fatura corrente recebia a seguinte como sugestão — a última parcela ia
 * para lá e nada mudava na tela. E o aviso conta o que o main moveu, não o que
 * foi pedido.
 *
 * A compra é do mês que vem, dia 3, num cartão que fecha no dia 5: as três
 * faturas nascem Abertas em qualquer dia em que o teste rode, e a primeira é a
 * que o cartão abre.
 */
test.describe('Faturas — adiantar parcelas (RN-03)', () => {
  test('adianta a última parcela para a fatura em tela e avisa quantas moveu', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Adiantar E2E')
    await criarCategoria(page, 'Casa Adiantar E2E')

    const hoje = new Date()
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
    const dataCompra = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`

    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByRole('radio', { name: 'Parcelada', exact: true }).click()
    await page.getByLabel('Descrição').fill('Geladeira em tres vezes')
    await page.getByLabel(/^Categoria/).selectOption({ label: 'Casa Adiantar E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Adiantar E2E' })
    await page.getByLabel('Valor total (R$)').fill('900,00')
    await page.getByLabel('Total de parcelas').fill('3')
    await page.getByLabel('Data da compra').fill(dataCompra)
    await page.getByRole('button', { name: 'Registrar parcelada' }).click()
    await expect(page.getByRole('dialog', { name: 'Nova saída' })).toHaveCount(0)

    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Adiantar E2E')
    const tabela = page.getByRole('table')
    await expect(tabela.getByText('1/3')).toBeVisible()

    await acionarNoMenuDaLinha(
      page,
      page.getByRole('row').filter({ hasText: 'Geladeira em tres vezes' }),
      'Adiantar'
    )
    const modal = page.getByRole('dialog', { name: 'Adiantar parcelas' })
    // Só a fatura em tela é destino possível: as outras duas vêm depois dela.
    // Habilitado primeiro — durante a carga o select também tem uma opção só,
    // "Carregando…".
    const destino = modal.getByLabel('Fatura destino')
    await expect(destino).toBeEnabled()
    await expect(destino.locator('option')).toHaveCount(1)
    await modal.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText('1 parcela adiantada.')).toBeVisible()
    await expect(tabela.getByText('3/3')).toBeVisible()
    await expect(tabela.getByText('1/3')).toBeVisible()
  })
})
