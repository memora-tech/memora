import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · Memora` : 'Memora'
    return () => {
      document.title = previous
    }
  }, [title])
}
