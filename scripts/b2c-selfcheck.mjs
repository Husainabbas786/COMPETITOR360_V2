// Verifies the pure B2C compute engine against the stakeholder-confirmed totals.
// Run: npm run b2c:check
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createB2CCompute } from '../src/lib/b2cCompute.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schema = JSON.parse(readFileSync(join(root, 'src/data/master-schema.json'), 'utf8'))

const b2c = createB2CCompute(schema)
const { passed } = b2c.sanityCheck()
process.exit(passed ? 0 : 1)
