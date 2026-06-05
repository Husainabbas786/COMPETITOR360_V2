// Singleton engines wired to the master data. Views and the inference layer
// all share these, so there is one computation path and one data source.
import { DATA } from '../data/master.js'
import { createPricingEngine } from './pricing.js'
import { createCommissionEngine } from './commission.js'

export const pricing = createPricingEngine(DATA)
export const commission = createCommissionEngine(DATA)
