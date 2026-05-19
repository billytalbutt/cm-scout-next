import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClubDetailPayload, ClubListRow } from '../ClubBrowsePanel'

const SUGGEST_LIMIT = 40

export function useClubBrowse(
  loadInfo: boolean,
  onClubSelectForTactics?: (clubId: number | null, clubName?: string | null) => void,
) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [suggestions, setSuggestions] = useState<ClubListRow[]>([])
  const [lockedName, setLockedName] = useState<string | null>(null)
  const [selId, setSelId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClubDetailPayload | null>(null)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const seqRef = useRef(0)
  const blurCloseRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 120)
    return () => window.clearTimeout(id)
  }, [q])

  const loadSuggestions = useCallback(async () => {
    if (!loadInfo || typeof window.cmapi?.getClubRows !== 'function') {
      setSuggestions([])
      return
    }
    if (!debouncedQ) {
      setSuggestions([])
      return
    }
    const seq = ++seqRef.current
    setLoadingSuggest(true)
    setErr(null)
    try {
      const out = await window.cmapi.getClubRows({ q: debouncedQ, offset: 0, limit: SUGGEST_LIMIT })
      if (seq !== seqRef.current) return
      setSuggestions((out.rows ?? []) as ClubListRow[])
    } catch (e) {
      if (seq !== seqRef.current) return
      setErr(e instanceof Error ? e.message : String(e))
      setSuggestions([])
    } finally {
      if (seq === seqRef.current) setLoadingSuggest(false)
    }
  }, [loadInfo, debouncedQ])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  const loadDetail = useCallback(async (id: number) => {
    if (typeof window.cmapi?.getClubDetail !== 'function') return
    setErr(null)
    try {
      const d = (await window.cmapi.getClubDetail(id)) as ClubDetailPayload | null
      setDetail(d)
    } catch (e) {
      setDetail(null)
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (selId == null) {
      setDetail(null)
      return
    }
    void loadDetail(selId)
  }, [selId, loadDetail])

  const onInputChange = (next: string) => {
    setQ(next)
    if (lockedName != null && next !== lockedName) {
      setLockedName(null)
      setSelId(null)
      onClubSelectForTactics?.(null, null)
    }
  }

  const pickClub = (c: ClubListRow) => {
    setLockedName(c.name)
    setQ(c.name)
    setSelId(c.id)
    setMenuOpen(false)
    onClubSelectForTactics?.(c.id, c.name)
  }

  const clearClubSearch = () => {
    setQ('')
    setLockedName(null)
    setSelId(null)
    setDetail(null)
    setSuggestions([])
    setErr(null)
    onClubSelectForTactics?.(null, null)
  }

  const onInputBlur = () => {
    blurCloseRef.current = window.setTimeout(() => setMenuOpen(false), 150)
  }

  const onInputFocus = () => {
    if (blurCloseRef.current) window.clearTimeout(blurCloseRef.current)
    setMenuOpen(true)
  }

  return {
    q,
    onInputChange,
    onInputFocus,
    onInputBlur,
    pickClub,
    clearClubSearch,
    suggestions,
    selId,
    detail,
    loadingSuggest,
    err,
    menuOpen,
    debouncedQ,
  }
}
