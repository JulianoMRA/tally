import { describe, it, expect } from 'vitest'
import { openInMemoryDatabase } from '../database'

describe('openInMemoryDatabase', () => {
  it('should open, execute SELECT 1 and close without errors', () => {
    const db = openInMemoryDatabase()
    const result = db.prepare('SELECT 1 AS value').get() as { value: number }
    expect(result.value).toBe(1)
    db.close()
  })

  it('should enforce foreign keys', () => {
    const db = openInMemoryDatabase()
    const pragmaResult = db.pragma('foreign_keys', { simple: true })
    expect(pragmaResult).toBe(1)
    db.close()
  })
})
