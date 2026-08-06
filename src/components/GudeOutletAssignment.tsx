import { useEffect, useMemo, useState } from 'react'
import {
  loadGudeStatus,
  type GudePort,
} from '../gudePower'
import './GudeOutletAssignment.css'

type GudeSource = {
  deviceId: string
  title: string
}

type ExistingAssignment = {
  deviceId: string
  deviceTitle: string
  gudeDeviceId: string
  port: number
}

type OutletResult = {
  source: GudeSource
  port: GudePort
}

type GudeOutletAssignmentProps = {
  clientId: string
  deviceTitle: string
  sources: GudeSource[]
  assignments: ExistingAssignment[]
  isSaving: boolean
  onAssign: (gudeDeviceId: string, port: number) => Promise<void>
}

export default function GudeOutletAssignment({
  clientId,
  deviceTitle,
  sources,
  assignments,
  isSaving,
  onAssign,
}: GudeOutletAssignmentProps) {
  const [outlets, setOutlets] = useState<OutletResult[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [failedSourceCount, setFailedSourceCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadOutlets() {
      setLoading(true)
      setError('')

      const results = await Promise.allSettled(sources.map(async source => {
        const status = await loadGudeStatus(clientId, source.deviceId)
        return status.ports.map(port => ({ source, port }))
      }))

      if (cancelled) return
      const available = results.flatMap(result =>
        result.status === 'fulfilled' ? result.value : [],
      )
      const failures = results.filter(result => result.status === 'rejected')
      setOutlets(available)
      setFailedSourceCount(failures.length)
      if (available.length === 0) {
        setError(failures[0]?.status === 'rejected' && failures[0].reason instanceof Error
          ? failures[0].reason.message
          : 'No GUDE outlets are currently available')
      }
      setLoading(false)
    }

    void loadOutlets()
    return () => { cancelled = true }
  }, [clientId, sources])

  const assignmentByOutlet = useMemo(() => new Map(
    assignments.map(item => [
      `${item.gudeDeviceId}:${item.port}`,
      item,
    ]),
  ), [assignments])

  const visibleOutlets = useMemo(() => {
    const normalised = query.trim().toLowerCase()
    if (!normalised) return outlets
    return outlets.filter(({ source, port }) =>
      `${source.title} ${port.number} ${port.name} ${port.state}`
        .toLowerCase()
        .includes(normalised),
    )
  }, [outlets, query])

  return (
    <div className="gude-outlet-assignment">
      <div className="gude-outlet-assignment-heading">
        <div>
          <p className="eyebrow">ASSIGN GUDE POWER</p>
          <strong>{deviceTitle}</strong>
          <span>Select the physical outlet that powers this device.</span>
        </div>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search GUDE, outlet or port…"
          aria-label={`Search GUDE outlets for ${deviceTitle}`}
          disabled={loading}
        />
      </div>

      {failedSourceCount > 0 && outlets.length > 0 && (
        <p className="gude-outlet-warning">
          {failedSourceCount} GUDE {failedSourceCount === 1 ? 'device is' : 'devices are'} unavailable; showing the outlets that responded.
        </p>
      )}
      {error && <p className="gude-control-error" role="alert">{error}</p>}
      {loading && <p className="gude-outlet-loading">Reading live GUDE outlets…</p>}

      {!loading && !error && (
        <div className="gude-outlet-results">
          {visibleOutlets.map(({ source, port }) => {
            const existing = assignmentByOutlet.get(`${source.deviceId}:${port.number}`)
            return (
              <div className="gude-outlet-result" key={`${source.deviceId}:${port.number}`}>
                <span className={`gude-outlet-state ${port.state}`} aria-hidden="true" />
                <div>
                  <strong>{port.name}</strong>
                  <span>{source.title} · port {port.number}</span>
                  {existing && <small>Assigned to {existing.deviceTitle}</small>}
                </div>
                <button
                  type="button"
                  disabled={Boolean(existing) || isSaving}
                  title={existing ? `Already assigned to ${existing.deviceTitle}` : undefined}
                  onClick={() => {
                    if (!window.confirm(
                      `Assign ${deviceTitle} to ${source.title} port ${port.number} (${port.name})?\n\nFuture power controls on this device card will operate that physical outlet.`,
                    )) return
                    void onAssign(source.deviceId, port.number)
                  }}
                >
                  {isSaving ? 'Saving…' : existing ? 'Assigned' : 'Assign'}
                </button>
              </div>
            )
          })}
          {visibleOutlets.length === 0 && (
            <p className="gude-outlet-empty">No outlets match “{query}”.</p>
          )}
        </div>
      )}
    </div>
  )
}
