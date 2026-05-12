/** RLE reader from CMScoutIntrinsic CMBinaryReader.cs */
const BUFFER_SIZE = 64 * 1024

export class CmBinaryReader {
  private readonly file: Buffer
  private readonly compressed: boolean
  /** Physical read cursor in file (both modes). */
  private streamPos = 0
  private fBuffer = Buffer.alloc(BUFFER_SIZE)
  private fBufEmpty = true
  private fIntPos = 0
  private fReadPos = 0
  private fBufPos = 0

  constructor(file: Buffer, compressed: boolean) {
    this.file = file
    this.compressed = compressed
  }

  seek(offset: number): void {
    this.streamPos = offset
    this.fBufEmpty = true
    this.fIntPos = 0
    this.fReadPos = 0
    this.fBufPos = 0
  }

  private readFromFileInto(target: Buffer, targetOff: number, len: number): number {
    const end = Math.min(this.file.length, this.streamPos + len)
    const n = Math.max(0, end - this.streamPos)
    if (n > 0) this.file.copy(target, targetOff, this.streamPos, this.streamPos + n)
    this.streamPos += n
    return n
  }

  private readCompressedInto(out: Buffer, count: number): void {
    /** RLE output can be much larger than one 64KiB read window; stream until `out` is full. */
    const MAX_DECOMPRESSED_CHUNK = 80 * 1024 * 1024
    if (count > MAX_DECOMPRESSED_CHUNK) {
      throw new Error(`read too large for compressed buffer (${count} > ${MAX_DECOMPRESSED_CHUNK})`)
    }
    let intNewBufPos = 0
    while (intNewBufPos < count) {
      if (this.fIntPos !== this.fReadPos + BUFFER_SIZE || this.fBufEmpty) {
        this.fBufEmpty = false
        this.fBufPos = 0
        this.fReadPos = this.streamPos
        const n = this.readFromFileInto(this.fBuffer, 0, BUFFER_SIZE)
        this.fIntPos = this.fReadPos + n
      }
      if (BUFFER_SIZE - this.fBufPos < count * 2) {
        const tail = BUFFER_SIZE - this.fBufPos
        this.fBuffer.copy(this.fBuffer, 0, this.fBufPos, this.fBufPos + tail)
        this.fReadPos = this.fIntPos - tail
        this.streamPos = this.fReadPos
        const n = this.readFromFileInto(this.fBuffer, tail, BUFFER_SIZE - tail)
        this.fIntPos = this.fReadPos + n + tail
        this.fBufPos = 0
      }
      if (this.fBuffer[this.fBufPos] <= 128) {
        out[intNewBufPos] = this.fBuffer[this.fBufPos]
        intNewBufPos++
        this.fBufPos++
      } else {
        let byByteCount = this.fBuffer[this.fBufPos] - 128
        this.fBufPos++
        const byMultByte = this.fBuffer[this.fBufPos]
        this.fBufPos++
        if (byByteCount + intNewBufPos > count) {
          this.fBufPos -= 2
          this.fBuffer[this.fBufPos] = byByteCount - (count - intNewBufPos) + 128
          byByteCount = count - intNewBufPos
        }
        out.fill(byMultByte, intNewBufPos, intNewBufPos + byByteCount)
        intNewBufPos += byByteCount
      }
      if (this.fBufPos > BUFFER_SIZE) this.fBufEmpty = true
    }
  }

  readBytes(count: number): Buffer {
    if (!this.compressed) {
      const end = Math.min(this.file.length, this.streamPos + count)
      const b = this.file.subarray(this.streamPos, end)
      this.streamPos = end
      if (b.length !== count) throw new Error(`EOF: need ${count} got ${b.length}`)
      return Buffer.from(b)
    }
    const out = Buffer.alloc(count)
    this.readCompressedInto(out, count)
    return out
  }

  readInt32LE(): number {
    return this.readBytes(4).readInt32LE(0)
  }
  readUInt16LE(): number {
    return this.readBytes(2).readUInt16LE(0)
  }
  readInt16LE(): number {
    return this.readBytes(2).readInt16LE(0)
  }
  readUInt8(): number {
    return this.readBytes(1).readUInt8(0)
  }
  readInt8(): number {
    return this.readBytes(1).readInt8(0)
  }
  readDoubleLE(): number {
    return this.readBytes(8).readDoubleLE(0)
  }
}

export function readLatin1String(buf: Buffer, maxLen: number): string {
  let end = 0
  while (end < maxLen && buf[end] !== 0) end++
  return buf.subarray(0, end).toString('latin1')
}
