import { useSearchParams } from 'react-router-dom'

// List filters live in the URL so Back from a detail page restores them
export function useFilters(defaults) {
  const [ searchParams, setSearchParams ] = useSearchParams()

  const filters = Object.fromEntries(Object.keys(defaults).map(key => [ key, searchParams.get(key) ?? defaults[ key ] ]))
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const update = (changes, { keepPage = false } = {}) => {
    const next = { ...filters, ...changes }
    const params = Object.fromEntries(Object.entries(next).filter(([ , v ]) => v !== '' && v !== null && v !== undefined))
    if (keepPage && changes.page) params.page = String(changes.page)
    setSearchParams(params, { replace: true })
  }

  return {
    filters,
    page,
    setFilter: (key, value) => update({ [ key ]: value }),
    setFilters: (changes) => update(changes),
    setPage: (p) => update({ page: p > 1 ? p : '' }, { keepPage: true }),
    reset: () => setSearchParams({}, { replace: true }),
  }
}
