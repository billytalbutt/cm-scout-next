/**
 * Inspect Bobby Chapman (or any name) unhappiness bytes on a CM0102 .sav.
 * Usage: node scripts/probe-chapman-unhappiness.cjs "C:/path/to/save.sav"
 */
const fs = require('fs')

const SAVE = process.argv[2] || process.env.CM0102_GOLDEN_SAV || 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
const WANT_NAME = (process.env.CM0102_PROBE_NAME || 'Bobby Chapman').toLowerCase()

if (!fs.existsSync(SAVE)) {
  console.error('Save not found:', SAVE)
  process.exit(1)
}

function readLatin1(buf, max) {
  let end = 0
  while (end < max && buf[end]) end++
  return buf.toString('latin1', 0, end)
}

function readBlocks(b) {
  let o = 0
  o += 4
  o += 4
  const n = b.readUInt32LE(o)
  o += 4
  const blocks = []
  for (let i = 0; i < n; i++) {
    const position = b.readInt32LE(o)
    o += 4
    const size = b.readInt32LE(o)
    o += 4
    const nameBuf = b.subarray(o, o + 260)
    o += 260
    const name = readLatin1(nameBuf, 260)
    blocks.push({ position, size, name })
  }
  return blocks
}

const buf = fs.readFileSync(SAVE)
const blocks = readBlocks(buf)
const find = (n) =>
  blocks.find((b) => b.name.replace(/\0+$/g, '').trim().toLowerCase() === n.toLowerCase())

const fn = find('first names.dat')
const sn = find('second names.dat')
const cn = find('common names.dat')
const staffB = find('staff.dat')
const playerB = find('player.dat')
const contractB = find('contract.dat')
const prefB = find('preferences.dat')

if (!staffB || !playerB) {
  console.error('Missing staff.dat or player.dat')
  process.exit(1)
}

const first = buf.subarray(fn.position, fn.position + fn.size)
const second = buf.subarray(sn.position, sn.position + sn.size)
const common = cn ? buf.subarray(cn.position, cn.position + cn.size) : Buffer.alloc(0)

function nameAt(firstId, secondId, commonId) {
  const pick = (data, id) => {
    const off = id * 40
    return off + 40 <= data.length ? readLatin1(data.subarray(off, off + 40), 40).trim() : ''
  }
  const c = pick(common, commonId)
  if (c) return c
  const a = pick(first, firstId)
  const b = pick(second, secondId)
  return `${a} ${b}`.trim()
}

let staffIndex = -1
let staffId = 0
let playerRow = -1
let prefId = 0
for (let i = 0; staffB.position + (i + 1) * 110 <= staffB.position + staffB.size; i++) {
  const base = staffB.position + i * 110
  const firstId = buf.readInt32LE(base)
  const secondId = buf.readInt32LE(base + 4)
  const commonId = buf.readInt32LE(base + 8)
  const nm = nameAt(firstId, secondId, commonId).toLowerCase()
  if (!nm.includes(WANT_NAME)) continue
  staffIndex = i
  staffId = buf.readInt32LE(base + 12)
  playerRow = buf.readInt32LE(base + 0x61)
  prefId = buf.readInt32LE(base + 0x65)
  console.log('Found:', nameAt(firstId, secondId, commonId), { staffIndex, staffId, playerRow, prefId })
  break
}

if (staffIndex < 0) {
  console.error('No staff named', WANT_NAME)
  process.exit(1)
}

const playerId = buf.readInt32LE(playerB.position + playerRow * 70)
const morale = buf.readInt8(playerB.position + playerRow * 70 + 69)
const clubVal = buf.readUInt8(staffB.position + staffIndex * 110 + 0x60)
console.log('morale', morale, 'club_valuation', clubVal)

if (contractB) {
  let o = contractB.position + 8
  const count = buf.readInt32LE(contractB.position + 4)
  let found = false
  for (let i = 0; i < count; i++) {
    const row = o + i * 80
    const key = buf.readInt32LE(row)
    if (key !== staffId && key !== staffIndex && key !== playerRow && key !== playerId) continue
    found = true
    const clubUnhapp = buf.subarray(row + 8, row + 12)
    const complaints = buf.subarray(row + 54, row + 73)
    const nonZeroClub = [...clubUnhapp].filter((b) => b !== 0).length
    const nonZero = [...complaints].filter((b) => b !== 0).length
    console.log(
      'contract row @',
      row,
      'key',
      key,
      'clubUnhappNonZero',
      nonZeroClub,
      'playerIssueNonZero',
      nonZero,
      'issuesHex',
      complaints.toString('hex'),
    )
    console.log('  transfer_status', buf.readUInt8(row + 78), 'transfer_arranged', buf.readInt32LE(row + 74))
  }
  if (!found) console.log('NO contract row for keys', { staffId, staffIndex, playerRow, playerId })
}

if (prefB) {
  const spanStart =
    prefB.size >= 8 && (prefB.size - 8) % 52 === 0 ? prefB.position + 8 : prefB.position
  const spanEnd = prefB.position + prefB.size
  let hits = 0
  for (let off = spanStart; off + 52 <= spanEnd; off += 52) {
    const rid = buf.readInt32LE(off)
    if (rid !== prefId && rid !== staffId) continue
    hits++
    const dis = [
      buf.readInt32LE(off + 16),
      buf.readInt32LE(off + 20),
      buf.readInt32LE(off + 24),
      buf.readInt32LE(off + 40),
      buf.readInt32LE(off + 44),
      buf.readInt32LE(off + 48),
    ]
    console.log('preferences row @', off, 'id', rid, 'dislikes', dis)
  }
  if (!hits) console.log('NO preferences row for ids', { prefId, staffId })
}
