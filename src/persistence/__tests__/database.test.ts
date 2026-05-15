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
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(row.foreign_keys).toBe(1)
    db.close()
  })
})
