import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import './ClientPicker.css'

type Client = {
  id: string
  name: string
  active: boolean | null
  updatedAt: string | null
}

type ClientPickerProps = {
  clients: Client[]
  selectedClientId: string
  onChange: (clientId: string) => void
}

const RECENT_CLIENTS_KEY = 'watchkeeper.recentClientIds'
const MAX_RECENT_CLIENTS = 5

export default function ClientPicker({
  clients,
  selectedClientId,
  onChange,
}: ClientPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeOptionRef = useRef<HTMLButtonElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentClientIds, setRecentClientIds] =
    useState<string[]>(loadRecentClientIds)

  const selectedClient =
    clients.find(client => client.id === selectedClientId) ??
    clients[0]

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closePicker()
      }
    }

    document.addEventListener(
      'pointerdown',
      closeWhenClickingOutside,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        closeWhenClickingOutside,
      )
    }
  }, [])

  useEffect(() => {
    if (!selectedClientId) {
      return
    }

    setRecentClientIds(current => {
      const next = [
        selectedClientId,
        ...current.filter(id => id !== selectedClientId),
      ].slice(0, MAX_RECENT_CLIENTS)

      saveRecentClientIds(next)

      return next
    })
  }, [selectedClientId])

  const recentClients = useMemo(
    () =>
      recentClientIds
        .map(id => clients.find(client => client.id === id))
        .filter((client): client is Client => Boolean(client)),
    [clients, recentClientIds],
  )

  const normalisedQuery = query.trim().toLowerCase()

  const filteredClients = useMemo(() => {
    if (!normalisedQuery) {
      return clients
    }

    return clients.filter(client =>
      client.name.toLowerCase().includes(normalisedQuery),
    )
  }, [clients, normalisedQuery])

  const remainingClients = useMemo(() => {
    const recentIds = new Set(recentClients.map(client => client.id))

    return clients.filter(client => !recentIds.has(client.id))
  }, [clients, recentClients])

  const keyboardClients = useMemo(
    () =>
      normalisedQuery
        ? filteredClients
        : [...recentClients, ...remainingClients],
    [
      filteredClients,
      normalisedQuery,
      recentClients,
      remainingClients,
    ],
  )

  const activeClient = keyboardClients[activeIndex] ?? null

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const selectedIndex = keyboardClients.findIndex(
      client => client.id === selectedClientId,
    )

    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [isOpen, normalisedQuery])

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeIndex])

  function openPicker() {
    setIsOpen(true)
  }

  function closePicker() {
    setIsOpen(false)
    setQuery('')
  }

  function selectClient(clientId: string) {
    onChange(clientId)
    closePicker()
  }

  function handleKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (!isOpen) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp'
      ) {
        event.preventDefault()
        openPicker()
      }

      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()

      setActiveIndex(current =>
        Math.min(current + 1, keyboardClients.length - 1),
      )
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      setActiveIndex(current => Math.max(current - 1, 0))
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    }

    if (event.key === 'End') {
      event.preventDefault()

      setActiveIndex(
        Math.max(keyboardClients.length - 1, 0),
      )
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (activeClient) {
        selectClient(activeClient.id)
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closePicker()
    }
  }

  return (
    <div
      className="client-picker"
      ref={containerRef}
      onKeyDown={handleKeyboard}
    >
      <button
        className="client-picker-trigger"
        type="button"
        onClick={() =>
          isOpen ? closePicker() : openPicker()
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="status-dot status-dot-source" />

        <span className="client-picker-trigger-copy">
          <small>CLIENT</small>
          <strong>
            {selectedClient?.name ?? 'Select client'}
          </strong>
        </span>

        <span
          className="client-picker-chevron"
          aria-hidden="true"
        >
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <section className="client-picker-menu">
          <div className="client-picker-search">
            <input
              autoFocus
              type="search"
              role="combobox"
              value={query}
              onChange={event => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              placeholder="Search clients..."
              aria-label="Search Jetbuilt clients"
              aria-expanded="true"
              aria-controls="client-picker-results"
              aria-activedescendant={
                activeClient
                  ? optionId(activeClient.id)
                  : undefined
              }
            />
          </div>

          <div
            id="client-picker-results"
            className="client-picker-results"
            role="listbox"
          >
            {!normalisedQuery && recentClients.length > 0 && (
              <ClientSection
                title="Recently used"
                clients={recentClients}
                selectedClientId={selectedClientId}
                activeClientId={activeClient?.id ?? null}
                activeOptionRef={activeOptionRef}
                onHighlight={clientId => {
                  const index = keyboardClients.findIndex(
                    client => client.id === clientId,
                  )

                  if (index >= 0) {
                    setActiveIndex(index)
                  }
                }}
                onSelect={selectClient}
              />
            )}

            <ClientSection
              title={
                normalisedQuery
                  ? `${filteredClients.length} results`
                  : 'All clients'
              }
              clients={
                normalisedQuery
                  ? filteredClients
                  : remainingClients
              }
              selectedClientId={selectedClientId}
              activeClientId={activeClient?.id ?? null}
              activeOptionRef={activeOptionRef}
              onHighlight={clientId => {
                const index = keyboardClients.findIndex(
                  client => client.id === clientId,
                )

                if (index >= 0) {
                  setActiveIndex(index)
                }
              }}
              onSelect={selectClient}
            />

            {keyboardClients.length === 0 && (
              <div className="client-picker-empty">
                No clients match “{query}”
              </div>
            )}
          </div>

          <footer>
            <span>
              {clients.length} Jetbuilt clients · Use ↑ ↓ and Enter
            </span>
          </footer>
        </section>
      )}
    </div>
  )
}

type ClientSectionProps = {
  title: string
  clients: Client[]
  selectedClientId: string
  activeClientId: string | null
  activeOptionRef: RefObject<HTMLButtonElement>
  onHighlight: (clientId: string) => void
  onSelect: (clientId: string) => void
}

function ClientSection({
  title,
  clients,
  selectedClientId,
  activeClientId,
  activeOptionRef,
  onHighlight,
  onSelect,
}: ClientSectionProps) {
  if (clients.length === 0) {
    return null
  }

  return (
    <section className="client-picker-section">
      <h3>{title}</h3>

      {clients.map(client => {
        const selected = client.id === selectedClientId
        const active = client.id === activeClientId

        return (
          <button
            id={optionId(client.id)}
            ref={active ? activeOptionRef : undefined}
            type="button"
            role="option"
            aria-selected={selected}
            className={[
              'client-picker-option',
              selected ? 'selected' : '',
              active ? 'active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={client.id}
            onMouseEnter={() => onHighlight(client.id)}
            onClick={() => onSelect(client.id)}
          >
            <span>
              <strong>{client.name}</strong>

              {client.active === false && (
                <small>Inactive</small>
              )}
            </span>

            {selected && (
              <span
                className="client-picker-selected"
                aria-hidden="true"
              >
                ✓
              </span>
            )}
          </button>
        )
      })}
    </section>
  )
}

function optionId(clientId: string) {
  return `client-option-${clientId.replace(
    /[^a-zA-Z0-9_-]/g,
    '-',
  )}`
}

function loadRecentClientIds() {
  try {
    const value = localStorage.getItem(
      RECENT_CLIENTS_KEY,
    )

    if (!value) {
      return []
    }

    const parsed = JSON.parse(value)

    return Array.isArray(parsed)
      ? parsed.filter(
          item => typeof item === 'string',
        )
      : []
  } catch {
    return []
  }
}

function saveRecentClientIds(ids: string[]) {
  try {
    localStorage.setItem(
      RECENT_CLIENTS_KEY,
      JSON.stringify(ids),
    )
  } catch {
    // Recent-client history is optional.
  }
}
