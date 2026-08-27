import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, focarCartao } from './fixtures/navegacao'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'
import { semear } from './fixtures/seed'

/**
 * Os dois defeitos funcionais que a auditoria de ago/2026 encontrou, mais o
 * primeiro uso e a restauração de backup.
 */

test.describe('Faturas — valor na lista', () => {
  // A visão geral por cartão foi absorvida pelo trilho na fusão de lista e
  // detalhe (ponto 12). O que ela garantia — ver o valor de cada cartão sem
  // abrir nada — passa a ser garantido aqui.
  test('o trilho mostra o total da fatura corrente de cada cartão', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Faturas' }).click()

    const trilho = page.getByRole('group', { name: 'Cartões' })
    await expect(trilho.getByRole('button', { name: /^Inter Seed/ })).toBeVisible()
    await expect(trilho.getByRole('button', { name: /^Nubank Seed/ })).toBeVisible()

    // Antes a lista trazia mês, fechamento, vencimento e status — sem o valor,
    // que é a informação número um e só existia abrindo cada fatura.
    await expect(trilho.getByText(/R\$\s*400,00/).first()).toBeVisible()
  })

  test('meses anteriores ficam colapsados e abrem sob demanda', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Faturas' }).click()

    // O histórico é do cartão em foco. A fatura de mês anterior da seed está no
    // Nubank, e o foco padrão é o primeiro cartão — então é preciso trocar.
    await focarCartao(page, 'Nubank Seed')

    const expandir = page.getByRole('button', { name: /meses anteriores/ }).first()
    await expect(expandir).toHaveAttribute('aria-expanded', 'false')

    await expandir.click()
    await expect(expandir).toHaveAttribute('aria-expanded', 'true')
  })

  test('o filtro por status reduz a lista', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Faturas' }).click()
    await focarCartao(page, 'Nubank Seed')

    // O filtro veio da visão geral, onde varria todos os cartões. Agora vive no
    // histórico e age sobre as faturas passadas do cartão em foco — decisão de
    // ago/2026, tomada ao fundir as telas.
    const grupo = page.getByRole('radiogroup', { name: 'Filtrar faturas por status' })
    await grupo.getByRole('radio', { name: 'Pagas' }).click()

    // Nenhuma fatura está paga no seed: o histórico mostra o vazio do filtro.
    await expect(page.getByText('Nenhuma fatura neste filtro.').first()).toBeVisible()
  })
})

test.describe('Entrada avulsa sem fonte de renda', () => {
  test('registrar avulso nao cria fonte e nao pede uma', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Rendas' }).click()

    // Antes daqui, o painel abria com um seletor de fonte e o registro criava
    // (ou reusava) uma `renda` Avulsa — a entrada nao tinha onde guardar o
    // proprio nome. Agora ela tem, e a aba Fontes nao e tocada.
    await page.getByRole('button', { name: '+ Novo avulso' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nova entrada avulsa' })

    await expect(dialogo.getByLabel('Fonte')).toHaveCount(0)

    await dialogo.getByLabel('Descrição').fill('Venda da bicicleta')
    await dialogo.getByLabel('Valor (R$)').fill('300,00')
    await dialogo.getByRole('button', { name: 'Registrar' }).click()

    await expect(dialogo).toHaveCount(0)
    await expect(page.getByText('Venda da bicicleta')).toBeVisible()

    // A aba Fontes segue com as recorrentes do seed, sem nenhuma avulsa nova.
    await page.getByRole('tab', { name: 'Fontes de renda' }).click()
    await expect(page.getByText('Venda da bicicleta')).toHaveCount(0)
    await expect(page.getByText('Freela Seed')).toHaveCount(0)
  })

  test('editar a entrada corrige a descricao sem passar por fonte nenhuma', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Rendas' }).click()

    // O seed cria "Freela Seed" como entrada avulsa. Antes, corrigir esse nome
    // exigia editar a fonte auto-criada na aba Fontes; agora a propria linha
    // tem a acao.
    const linha = page.locator('li', { hasText: 'Freela Seed' }).first()
    await acionarNoMenuDaLinha(page, linha, 'Editar')

    const dialogo = page.getByRole('dialog', { name: 'Editar entrada avulsa' })
    await dialogo.getByLabel('Descrição').fill('Freela do cliente X')
    await dialogo.getByRole('button', { name: 'Salvar' }).click()

    await expect(dialogo).toHaveCount(0)
    await expect(page.getByText('Freela do cliente X')).toBeVisible()
    await expect(page.getByText('Freela Seed')).toHaveCount(0)
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

    // Restaurar substitui a base inteira: pelo padrão da F7 ela saiu da linha
    // para o menu de ações, mesmo sendo a única ação da cópia.
    const linha = painel.getByRole('listitem')
    await expect(linha).toHaveCount(1)
    await linha.getByRole('button', { name: /^Mais ações/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Restaurar' })).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(painel.getByRole('button', { name: 'Abrir pasta' })).toBeVisible()
  })

  test('restaurar pede confirmação antes de substituir os dados', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Ajustes' }).click()

    await page.getByRole('button', { name: 'Fazer cópia agora' }).click()
    await acionarNoMenuDaLinha(page, page.getByRole('listitem').first(), 'Restaurar')

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText('Os dados atuais serão substituídos')
    await expect(dialogo).toContainText('cópia do estado atual é criada antes')
  })
})
