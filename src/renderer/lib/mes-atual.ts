/**
 * Re-export do módulo compartilhado: a fonte única de "hoje"/"mês atual"
 * no fuso local vive em src/shared/datas-locais.ts (usada também pelo main
 * process e pela persistence).
 */
export { mesAtualReferencia } from '@shared/datas-locais'
