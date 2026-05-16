import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const buf = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'),
  'player stats.dat',
)!
console.log('len', buf.length)
console.log(buf.subarray(0, 256).toString('hex'))
