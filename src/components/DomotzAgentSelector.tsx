import { useEffect, useState } from 'react'
import {
  loadDomotzAgents,
  type DomotzAgent,
} from '../domotz'

type DomotzAgentSelectorProps = {
  value: string
  onChange: (agentId: string) => void
}

export default function DomotzAgentSelector({
  value,
  onChange,
}: DomotzAgentSelectorProps) {
  const [agents, setAgents] = useState<DomotzAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAgents()
  }, [])

  async function loadAgents(forceRefresh = false) {
    setIsLoading(true)
    setError(null)

    try {
      setAgents(await loadDomotzAgents(forceRefresh))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to retrieve Domotz Collectors',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const linkedAgentIsMissing =
    Boolean(value) && !agents.some(agent => agent.id === value)

  return (
    <div className="domotz-agent-selector">
      <label className="site-config-field">
        <span>Domotz Collector</span>
        <select
          value={value}
          disabled={isLoading || Boolean(error)}
          onChange={event => onChange(event.target.value)}
        >
          <option value="">
            {isLoading
              ? 'Loading Collectors…'
              : 'Select a Domotz Collector'}
          </option>

          {linkedAgentIsMissing && (
            <option value={value}>
              Linked Collector {value} (not returned by Domotz)
            </option>
          )}

          {agents.map(agent => (
            <option
              key={agent.id}
              value={agent.id}
              disabled={!agent.apiEnabled}
            >
              {agent.name} — {collectorStatus(agent)}
            </option>
          ))}
        </select>
        <small>
          Watchkeeper stores only the Collector identifier. The Domotz API key
          remains in the server environment.
        </small>
      </label>

      {error && (
        <div className="domotz-agent-error" role="status">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadAgents(true)}
          >
            Try again
          </button>
        </div>
      )}

      {!error && !isLoading && agents.length === 0 && (
        <p className="domotz-agent-empty">
          The connected Domotz account returned no Collectors.
        </p>
      )}

      <a
        className="domotz-portal-link"
        href="https://portal.domotz.com"
        target="_blank"
        rel="noreferrer"
      >
        Open Domotz Portal ↗
      </a>
    </div>
  )
}

function collectorStatus(agent: DomotzAgent) {
  if (!agent.apiEnabled) {
    return 'API unavailable on plan'
  }

  return agent.status === 'UNKNOWN'
    ? 'status unavailable'
    : agent.status.toLocaleLowerCase('en-GB')
}
