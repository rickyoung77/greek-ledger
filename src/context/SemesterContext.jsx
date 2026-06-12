import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

// Tracks the chapter's semesters and which one the user is currently VIEWING.
// Data pages filter their queries by `viewingSemesterId`. New data always
// lands in the active semester (enforced by a DB trigger), so viewing an
// archived semester is effectively read-only.
const SemesterContext = createContext(null)

export function SemesterProvider({ children }) {
  const { chapterId } = useAuth()
  const [semesters, setSemesters]   = useState([])
  const [viewingId, setViewingId]   = useState(null)
  const [loading, setLoading]       = useState(true)

  const loadSemesters = useCallback(async () => {
    if (!chapterId) { setSemesters([]); setViewingId(null); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('semesters')
      .select('id, name, status, created_at')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: false })
    const list = data ?? []
    setSemesters(list)
    // Default to viewing the active semester.
    setViewingId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev
      return list.find((s) => s.status === 'active')?.id ?? list[0]?.id ?? null
    })
    setLoading(false)
  }, [chapterId])

  useEffect(() => { loadSemesters() }, [loadSemesters])

  const activeSemester  = semesters.find((s) => s.status === 'active') ?? null
  const viewingSemester = semesters.find((s) => s.id === viewingId) ?? null
  const isViewingActive = viewingSemester ? viewingSemester.status === 'active' : true

  // Admin action: archive the active semester and open a new one.
  async function rollOver(newName) {
    const { data, error } = await supabase.rpc('roll_over_semester', {
      cid: chapterId, new_name: newName,
    })
    if (error) return { error }
    await loadSemesters()
    setViewingId(data) // jump to the new active semester
    return { error: null, newId: data }
  }

  return (
    <SemesterContext.Provider
      value={{
        semesters, loading,
        activeSemester, viewingSemester, viewingSemesterId: viewingId,
        isViewingActive,
        setViewingId,
        refreshSemesters: loadSemesters,
        rollOver,
      }}
    >
      {children}
    </SemesterContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSemester = () => useContext(SemesterContext)
