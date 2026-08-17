import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida } from './fixtures/navegacao'
import { semear } from './fixtures/seed'

/**
 * Os dois defeitos funcionais que a auditoria de ago/2026 encontrou, mais o
 * primeiro uso e a restauração de backup.
 */

test.describe('Faturas — valor na lista', () => {
  test('a visão geral mostra o total de cada fatura e o do cartão', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Faturas' }).click()

    const painel = page.getByRole('heading', { name: 'Inter Seed' }).locator('..').locator('..')

    // Antes a lista trazia mês, fechamento, vencimento e status — sem o valor,
    // que é a informação número um e só existia abrindo cada fatura.
    await expect(painel.getByText(/R\$\s*400,00/).first()).toBeVisible()
  })

  test('meses anteriores ficam colapsados e abrem sob demanda', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Faturas' }).click()

    const expandir = page.getByRole('button', { name: /meses anteriores/ }).first()
    await expect(expandir).toHaveAttribute('aria-expanded', 'false')

    await expandir.click()
    await expect(expandir).toHaveAttribute('aria-expanded', 'true')
  })

  test('o filtro por status reduz a lista', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Faturas' }).click()

    const grupo = page.getByRole('radiogroup', { name: 'Filtrar faturas por status' })
    await grupo.getByRole('radio', { name: 'Pagas' }).click()

    // Nenhuma fatura está paga no seed: os painéis mostram o vazio do filtro.
    await expect(page.getByText('Nenhuma fatura neste filtro.').first()).toBeVisible()
  })
})

test.describe('Renda avulsa — fonte reaproveitada', () => {
  test('dois avulsos na mesma fonte não duplicam a fonte', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Rendas' }).click()

    // O seed já criou a fonte "Freela Seed" pelo primeiro avulso. O segundo
    // reusa a fonte em vez de criar outra — antes, cada "+ Novo avulso"
    // inseria uma renda, e três freelas viravam três fontes idênticas.
    await page.getByRole('button', { name: '+ Novo avulso' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Novo recebimento avulso' })
    await dialogo.getByLabel('Fonte').selectOption({ label: 'Freela Seed' })
    await dialogo.getByLabel('Valor (R$)').fill('300,00')
    await dialogo.getByRole('button', { name: 'Registrar' }).click()

    await expect(dialogo).toHaveCount(0)

    await page.getByRole('tab', { name: 'Fontes de renda' }).click()
    await expect(page.getByText('Freela Seed')).toHaveCount(1)
  })
})

test.describe('Primeiro uso', () => {
  test('base vazia mostra os três passos e o aviso de cartão em Saídas', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: 'Comece por aqui' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cadastre um cartão' })).toBeVisible()

    await page.getByRole('link', { name: 'Saídas' }).click()
    // O aviso fica na página, não dentro do painel: quem chega sem cartão
    // precisa vê-lo antes de abrir o formulário.
    await expect(page.getByText('Nenhum cartão cadastrado.')).toBeVisible()
    // E o formulário continua utilizável: Pix e débito não dependem de cartão.
    await abrirCadastroDeSaida(page)
    await expect(page.getByLabel('Descrição')).toBeVisible()
  })

  test('some assim que há dados', async ({ app }) => {
    const { page } = await semear(app)

    await expect(page.getByRole('heading', { name: 'Comece por aqui' })).toHaveCount(0)
  })
})

test.describe('Ajustes — cópias de segurança', () => {
  test('lista as cópias e oferece restaurar', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Ajustes' }).click()

    const painel = page
      .getByRole('heading', { name: 'Cópias de segurança' })
      .locator('..')
      .locator('..')

    // Base E2E nasce sem banco, então o backup do boot é no-op: a cópia vem do
    // botão sob demanda, que é justamente o que faltava para fechar o fluxo.
    await expect(painel.getByText('Nenhuma cópia ainda.')).toBeVisible()

    await painel.getByRole('button', { name: 'Fazer cópia agora' }).click()

    await expect(painel.getByRole('button', { name: 'Restaurar' })).toHaveCount(1)
    await expect(painel.getByRole('button', { name: 'Abrir pasta' })).toBeVisible()
  })

  test('restaurar pede confirmação antes de substituir os dados', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Ajustes' }).click()

    await page.getByRole('button', { name: 'Fazer cópia agora' }).click()
    await page.getByRole('button', { name: 'Restaurar' }).first().click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText('Os dados atuais serão substituídos')
    await expect(dialogo).toContainText('cópia do estado atual é criada antes')
  })
})
