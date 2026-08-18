import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, focarCartao } from './fixtures/navegacao'
import type { Page } from '@playwright/test'

/**
 * Selo "vencida há N dias" para faturas Fechadas com vencimento passado.
 *
 * A compra é retroativa (2026-05-03): sua fatura vence em 2026-05-12, uma data
 * fixa no passado — o selo aparece de forma estável independentemente de quando
 * o teste roda. A asserção usa /vencida há/ (não o número de dias) justamente
 * para não depender da distância até hoje.
 *
 * Pelo mesmo motivo a navegação da Visão mensal é absoluta (preenche o input de
 * mês) e não relativa. A versão original clicava duas vezes em "Mês anterior"
 * com o comentário "jul -> jun -> maio": passou verde em julho/2026 e quebrou
 * sozinha na virada para agosto, quando dois cliques passaram a cair em junho.
 */

async function ir(page: Page, link: string) {
  await page.getByRole('link', { name: link }).click()
}

test.describe('Fatura vencida', () => {
  test('mostra o selo na Visão mensal e no detalhe; some quando paga', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await ir(page, 'Cartões')
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Vencida E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Vencida E2E')).toBeVisible()

    await ir(page, 'Categorias')
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Vencida E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Vencida E2E')).toBeVisible()

    // Compra retroativa: fatura de maio/2026, vencimento 2026-05-12 (passado).
    await ir(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Compra retroativa de maio')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Vencida E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Vencida E2E' })
    await page.getByLabel('Valor (R$)').fill('523,40')
    await page.getByLabel('Data da compra').fill('2026-05-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra retroativa de maio' })).toBeVisible()

    // Visão mensal em maio/2026: o card exibe o selo. O mês vai direto no
    // input (exact: true — "Mês anterior" e "Próximo mês" também casariam),
    // nunca por cliques relativos ao mês corrente.
    await ir(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill('2026-05')
    // Confirma o filtro pelo próprio campo. Antes isto olhava um rótulo
    // "Maio de 2026" ao lado do input, que repetia o que o campo já dizia e
    // saiu no refactor visual (ponto 06 do diagnóstico).
    await expect(page.getByLabel('Mês', { exact: true })).toHaveValue('2026-05')
    await expect(page.getByText(/vencida há \d+ dias?/)).toBeVisible()

    // Detalhe da fatura: o aside de status também exibe o selo.
    await ir(page, 'Faturas')
    await focarCartao(page, 'Inter Vencida E2E')
    // O cartão em foco já abre a fatura dele: não há mais lista para clicar
    // (ponto 12). Estes testes usam cartão com uma fatura só, então é ela.
    await expect(page.getByText('Inter Vencida E2E · maio de 2026')).toBeVisible()
    // `.first()`: o trilho passou a exibir o mesmo selo do painel, porque ele
    // mostra a situação corrente de cada cartão.
    await expect(page.getByText(/vencida há \d+ dias?/).first()).toBeVisible()

    // A fatura de maio já nasce Fechada (fechamento 05/05 passou). Pagá-la
    // remove o selo: fatura Paga nunca é vencida.
    await page.getByRole('button', { name: 'Marcar como paga' }).click()
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
    await expect(page.getByText(/vencida há/)).toHaveCount(0)
  })
})
