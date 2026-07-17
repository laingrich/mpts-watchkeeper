import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
} from 'react'
import saltmarshLauncher from '../data/saltmarsh-device-launcher.json'
import './DeviceLauncher.css'

type DetailCell = string | number | string[]
type DetailRow = DetailCell[]

type DeviceDetails = {
  type: string
  title: string
  rows: DetailRow[]
}

type LauncherDevice = {
  id: string
  title: string
  link: string
  group: string
  details?: DeviceDetails
}

type LauncherGroup = {
  id: string
  title: string
  accent: string
}

type LauncherConfig = {
  version: number
  groups: LauncherGroup[]
  devices: LauncherDevice[]
}

type ConfigResponse = {
  config: LauncherConfig
  etag: string | null
  updatedAt: string | null
  updatedBy: string | null
}

type DeviceLauncherProps = {
  siteId: string
  siteName: string
  onDeviceCountChange?: (count: number) => void
}

type DeviceDraft = {
  mode: 'add' | 'edit'
  device: LauncherDevice
  hasMap: boolean
  mapRowsText: string
}

type GroupDraft = {
  mode: 'add' | 'edit'
  group: LauncherGroup
}

const saltmarshSeed = saltmarshLauncher as LauncherConfig

const defaultGroups: LauncherGroup[] = [
  {
    id: 'management',
    title: 'Management',
    accent: 'rgba(168, 85, 247, 0.56)',
  },
  {
    id: 'power',
    title: 'Power',
    accent: 'rgba(245, 158, 11, 0.42)',
  },
  {
    id: 'audio-video-distribution',
    title: 'Audio / Video Distribution',
    accent: 'rgba(59, 130, 246, 0.42)',
  },
  {
    id: 'audio-amplifiers',
    title: 'Audio Amplifiers',
    accent: 'rgba(34, 197, 94, 0.34)',
  },
  {
    id: 'cinema',
    title: 'Cinema',
    accent: 'rgba(244, 63, 94, 0.38)',
  },
]

export function getLauncherDeviceCount(
  _clientId: string,
  fallback: number,
  clientName = '',
) {
  return isSaltmarsh(clientName)
    ? saltmarshSeed.devices.length
    : fallback
}

function isSaltmarsh(clientName: string) {
  return clientName.trim().toLowerCase() === 'saltmarsh house'
}

function createInitialConfig(clientName: string): LauncherConfig {
  if (isSaltmarsh(clientName)) {
    return structuredClone(saltmarshSeed)
  }

  return {
    version: 1,
    groups: structuredClone(defaultGroups),
    devices: [],
  }
}

function renderCell(cell: DetailCell) {
  if (Array.isArray(cell)) {
    return (
      <ul className="launcher-cell-list">
        {cell.map(item => <li key={item}>{item}</li>)}
      </ul>
    )
  }

  return cell || '—'
}

function DetailTable({ details }: { details: DeviceDetails }) {
  return (
    <div className="launcher-table-wrap">
      <table className="launcher-table">
        <tbody>
          {details.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.map(String).join('-')}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DeviceLauncher({
  siteId: clientId,
  siteName: clientName,
  onDeviceCountChange,
}: DeviceLauncherProps) {
  const [config, setConfig] = useState<LauncherConfig | null>(null)
  const [savedConfig, setSavedConfig] = useState<LauncherConfig | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] =
    useState<Set<string>>(new Set())
  const [expandedMaps, setExpandedMaps] =
    useState<Set<string>>(new Set())
  const [deviceDraft, setDeviceDraft] =
    useState<DeviceDraft | null>(null)
  const [groupDraft, setGroupDraft] =
    useState<GroupDraft | null>(null)
  const [draggedDeviceId, setDraggedDeviceId] =
    useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadConfig()
  }, [clientId])

  useEffect(() => {
    if (config) {
      onDeviceCountChange?.(config.devices.length)
    }
  }, [config?.devices.length, onDeviceCountChange])

  async function loadConfig() {
    setIsLoading(true)
    setError(null)
    setExpandedMaps(new Set())
    setIsEditing(false)

    try {
      const response = await fetch(
        `/api/device-config/${encodeURIComponent(clientId)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

      if (response.status === 404) {
        const initial = createInitialConfig(clientName)
        setConfig(initial)
        setSavedConfig(structuredClone(initial))
        setEtag(null)
        setUpdatedAt(null)
        setUpdatedBy(null)
        return
      }

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data = (await response.json()) as ConfigResponse
      setConfig(data.config)
      setSavedConfig(structuredClone(data.config))
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the device launcher',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const visibleGroups = useMemo(() => {
    if (!config) return []

    const normalised = query.trim().toLowerCase()

    return config.groups
      .map(group => {
        const devices = config.devices.filter(device => {
          if (device.group !== group.id) return false
          if (!normalised) return true

          const detailsText =
            device.details?.rows.flat(2).join(' ') ?? ''

          return `${device.title} ${device.link} ${group.title} ${detailsText}`
            .toLowerCase()
            .includes(normalised)
        })

        return { group, devices }
      })
      .filter(item => item.devices.length > 0 || isEditing)
  }, [config, query, isEditing])

  const mappedDeviceIds = useMemo(
    () =>
      new Set(
        config?.devices
          .filter(device => device.details)
          .map(device => device.id) ?? [],
      ),
    [config],
  )

  const allMapsOpen =
    mappedDeviceIds.size > 0 &&
    [...mappedDeviceIds].every(id => expandedMaps.has(id))

  if (isLoading) {
    return (
      <section className="panel empty-state">
        <h3>Loading device launcher</h3>
        <p>Retrieving the shared launcher for {clientName}…</p>
      </section>
    )
  }

  if (error && !config) {
    return (
      <section className="panel empty-state">
        <h3>Unable to load devices</h3>
        <p>{error}</p>
        <button
          className="retry-button"
          type="button"
          onClick={() => void loadConfig()}
        >
          Try again
        </button>
      </section>
    )
  }

  if (!config) {
    return null
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroups(current => {
      const next = new Set(current)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  function setAllGroups(collapsed: boolean) {
    if (!config) return

    setCollapsedGroups(
      collapsed
        ? new Set(config.groups.map(group => group.id))
        : new Set(),
    )
  }

  function toggleMap(deviceId: string) {
    setExpandedMaps(current => {
      const next = new Set(current)
      next.has(deviceId) ? next.delete(deviceId) : next.add(deviceId)
      return next
    })
  }

  function toggleAllMaps() {
    if (!config) return
    if (allMapsOpen) {
      setExpandedMaps(new Set())
      return
    }

    setExpandedMaps(new Set(mappedDeviceIds))

    const groupsWithMaps = new Set(
      config.devices
        .filter(device => device.details)
        .map(device => device.group),
    )

    setCollapsedGroups(current => {
      const next = new Set(current)
      groupsWithMaps.forEach(groupId => next.delete(groupId))
      return next
    })
  }

  function beginEditing() {
    setSavedConfig(structuredClone(config))
    setIsEditing(true)
    setError(null)
  }

  function cancelEditing() {
    if (savedConfig) {
      setConfig(structuredClone(savedConfig))
    }

    setIsEditing(false)
    setDeviceDraft(null)
    setGroupDraft(null)
    setDraggedDeviceId(null)
    setError(null)
  }

  async function saveChanges() {
    setIsSaving(true)
    setError(null)

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      if (etag) {
        headers['If-Match'] = etag
      }

      const response = await fetch(
        `/api/device-config/${encodeURIComponent(clientId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(config),
        },
      )

      if (response.status === 409 || response.status === 412) {
        throw new Error(
          'Another user changed this launcher. Reload it before saving again.',
        )
      }

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data = (await response.json()) as ConfigResponse
      setConfig(data.config)
      setSavedConfig(structuredClone(data.config))
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
      setIsEditing(false)
      setDeviceDraft(null)
      setGroupDraft(null)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save the device launcher',
      )
    } finally {
      setIsSaving(false)
    }
  }

  function addDevice(groupId?: string) {
    if (!config) return
    const group = groupId ?? config.groups[0]?.id

    if (!group) {
      setError('Create a group before adding a device')
      return
    }

    setDeviceDraft({
      mode: 'add',
      device: {
        id: '',
        title: '',
        link: 'http://',
        group,
      },
      hasMap: false,
      mapRowsText: '',
    })
  }

  function editDevice(device: LauncherDevice) {
    setDeviceDraft({
      mode: 'edit',
      device: structuredClone(device),
      hasMap: Boolean(device.details),
      mapRowsText: device.details
        ? serialiseRows(device.details.rows)
        : '',
    })
  }

  function applyDeviceDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!deviceDraft) return

    const title = deviceDraft.device.title.trim()
    const link = deviceDraft.device.link.trim()

    if (!title || !link) {
      setError('Device name and URL are required')
      return
    }

    const device: LauncherDevice = {
      ...deviceDraft.device,
      id:
        deviceDraft.mode === 'add'
          ? createDeviceId(title)
          : deviceDraft.device.id,
      title,
      link,
    }

    if (deviceDraft.hasMap) {
      device.details = {
        type: deviceDraft.device.details?.type || 'map',
        title:
          deviceDraft.device.details?.title?.trim() ||
          'Device map',
        rows: parseRows(deviceDraft.mapRowsText),
      }
    } else {
      delete device.details
    }

    setConfig(current => {
      if (!current) return current

      return {
        ...current,
        devices:
          deviceDraft.mode === 'add'
            ? [...current.devices, device]
            : current.devices.map(item =>
                item.id === device.id ? device : item,
              ),
      }
    })

    setDeviceDraft(null)
  }

  function removeDevice(device: LauncherDevice) {
    if (!window.confirm(`Remove "${device.title}"?`)) return

    setConfig(current =>
      current
        ? {
            ...current,
            devices: current.devices.filter(
              item => item.id !== device.id,
            ),
          }
        : current,
    )

    setExpandedMaps(current => {
      const next = new Set(current)
      next.delete(device.id)
      return next
    })
  }

  function addGroup() {
    setGroupDraft({
      mode: 'add',
      group: {
        id: '',
        title: '',
        accent: 'rgba(59, 130, 246, 0.42)',
      },
    })
  }

  function editGroup(group: LauncherGroup) {
    setGroupDraft({
      mode: 'edit',
      group: structuredClone(group),
    })
  }

  function applyGroupDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!groupDraft || !config) return

    const title = groupDraft.group.title.trim()

    if (!title) {
      setError('Group title is required')
      return
    }

    const group: LauncherGroup = {
      ...groupDraft.group,
      id:
        groupDraft.mode === 'add'
          ? createGroupId(title, config.groups)
          : groupDraft.group.id,
      title,
      accent:
        groupDraft.group.accent.trim() ||
        'rgba(59, 130, 246, 0.42)',
    }

    setConfig(current => {
      if (!current) return current

      return {
        ...current,
        groups:
          groupDraft.mode === 'add'
            ? [...current.groups, group]
            : current.groups.map(item =>
                item.id === group.id ? group : item,
              ),
      }
    })

    setGroupDraft(null)
  }

  function removeGroup(group: LauncherGroup) {
    if (!config) return
    const deviceCount = config.devices.filter(
      device => device.group === group.id,
    ).length

    if (deviceCount > 0) {
      setError(
        `Move or remove the ${deviceCount} devices in "${group.title}" first.`,
      )
      return
    }

    if (!window.confirm(`Remove group "${group.title}"?`)) return

    setConfig(current =>
      current
        ? {
            ...current,
            groups: current.groups.filter(
              item => item.id !== group.id,
            ),
          }
        : current,
    )
  }

  function moveGroup(groupId: string, offset: -1 | 1) {
    setConfig(current => {
      if (!current) return current

      const groups = [...current.groups]
      const from = groups.findIndex(group => group.id === groupId)
      const to = from + offset

      if (from < 0 || to < 0 || to >= groups.length) {
        return current
      }

      const [group] = groups.splice(from, 1)
      groups.splice(to, 0, group)

      return { ...current, groups }
    })
  }

  function handleDeviceDrop(
    event: DragEvent<HTMLElement>,
    targetDevice: LauncherDevice,
  ) {
    event.preventDefault()

    if (!draggedDeviceId || draggedDeviceId === targetDevice.id) {
      return
    }

    setConfig(current => {
      if (!current) return current

      const devices = [...current.devices]
      const from = devices.findIndex(
        device => device.id === draggedDeviceId,
      )
      const targetIndex = devices.findIndex(
        device => device.id === targetDevice.id,
      )

      if (from < 0 || targetIndex < 0) return current

      const [dragged] = devices.splice(from, 1)
      dragged.group = targetDevice.group

      const adjustedTarget = devices.findIndex(
        device => device.id === targetDevice.id,
      )

      devices.splice(adjustedTarget, 0, dragged)

      return { ...current, devices }
    })

    setDraggedDeviceId(null)
  }

  return (
    <section className="launcher">
      <div className="launcher-editor-bar">
        <div>
          <strong>{config.devices.length} devices</strong>
          <span>
            {updatedAt
              ? `Last saved ${formatDate(updatedAt)}${
                  updatedBy ? ` by ${updatedBy}` : ''
                }`
              : 'Not yet saved to Watchkeeper'}
          </span>
        </div>

        <div className="launcher-editor-actions">
          {isEditing ? (
            <>
              <button type="button" onClick={addGroup}>
                Add group
              </button>
              <button type="button" onClick={() => addDevice()}>
                Add device
              </button>
              <button type="button" onClick={cancelEditing}>
                Cancel
              </button>
              <button
                className="launcher-primary-action"
                type="button"
                disabled={isSaving}
                onClick={() => void saveChanges()}
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <button
              className="launcher-primary-action"
              type="button"
              onClick={beginEditing}
            >
              Edit launcher
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="launcher-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="launcher-toolbar">
        <input
          className="search launcher-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search devices, groups, zones or outlets..."
          aria-label="Search device launcher"
        />

        <div className="launcher-actions">
          <button type="button" onClick={() => setAllGroups(false)}>
            Expand groups
          </button>
          <button type="button" onClick={() => setAllGroups(true)}>
            Collapse groups
          </button>
          <button
            type="button"
            disabled={mappedDeviceIds.size === 0}
            onClick={toggleAllMaps}
          >
            {allMapsOpen ? 'Close all maps' : 'Open all maps'}
          </button>
        </div>
      </div>

      <p className="launcher-network-note">
        Device pages are available only while your computer has access
        to the client network or VPN.
      </p>

      {visibleGroups.length === 0 ? (
        <article className="panel empty-state">
          <h3>No matching devices</h3>
          <p>Try another device, group, room, zone or outlet.</p>
        </article>
      ) : (
        visibleGroups.map(({ group, devices }, groupIndex) => {
          const collapsed = collapsedGroups.has(group.id)

          return (
            <section
              className="launcher-group"
              key={group.id}
              style={{
                '--launcher-accent': group.accent,
              } as CSSProperties}
            >
              <div className="launcher-group-heading">
                <button
                  className="launcher-group-toggle"
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!collapsed}
                >
                  <span>
                    <span className="launcher-group-dot" />
                    {group.title}
                  </span>
                  <small>{devices.length} devices</small>
                  <strong aria-hidden="true">
                    {collapsed ? '+' : '−'}
                  </strong>
                </button>

                {isEditing && (
                  <div className="launcher-group-edit-actions">
                    <button
                      type="button"
                      disabled={groupIndex === 0}
                      onClick={() => moveGroup(group.id, -1)}
                      aria-label={`Move ${group.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={groupIndex === config.groups.length - 1}
                      onClick={() => moveGroup(group.id, 1)}
                      aria-label={`Move ${group.title} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => addDevice(group.id)}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => editGroup(group)}
                    >
                      Edit
                    </button>
                    <button
                      className="launcher-danger-action"
                      type="button"
                      onClick={() => removeGroup(group)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {!collapsed && (
                <div className="launcher-grid">
                  {devices.map(device => {
                    const mapOpen = expandedMaps.has(device.id)

                    return (
                      <article
                        className={[
                          'launcher-card',
                          mapOpen ? 'map-open' : '',
                          draggedDeviceId === device.id
                            ? 'dragging'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        key={device.id}
                        draggable={isEditing}
                        onDragStart={() =>
                          setDraggedDeviceId(device.id)
                        }
                        onDragEnd={() => setDraggedDeviceId(null)}
                        onDragOver={event => {
                          if (isEditing) event.preventDefault()
                        }}
                        onDrop={event =>
                          handleDeviceDrop(event, device)
                        }
                      >
                        <div className="launcher-card-main">
                          <div className="launcher-card-copy">
                            <p className="eyebrow">
                              {device.details
                                ? device.details.title
                                : group.title}
                            </p>
                            <h3>{device.title}</h3>
                            <span>{device.link}</span>
                          </div>

                          <div className="launcher-card-actions">
                            {isEditing ? (
                              <>
                                <span
                                  className="launcher-drag-handle"
                                  title="Drag to reorder"
                                >
                                  ⋮⋮
                                </span>
                                <button
                                  type="button"
                                  onClick={() => editDevice(device)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="launcher-danger-action"
                                  type="button"
                                  onClick={() => removeDevice(device)}
                                >
                                  Remove
                                </button>
                              </>
                            ) : (
                              <>
                                {device.details && (
                                  <button
                                    type="button"
                                    onClick={() => toggleMap(device.id)}
                                  >
                                    {mapOpen ? 'Hide map' : 'Show map'}
                                  </button>
                                )}
                                <a
                                  href={device.link}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open device
                                </a>
                              </>
                            )}
                          </div>
                        </div>

                        {device.details && mapOpen && (
                          <div className="launcher-inline-map">
                            <div className="launcher-inline-map-heading">
                              <div>
                                <p className="eyebrow">
                                  {device.details.title}
                                </p>
                                <h4>{device.title}</h4>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleMap(device.id)}
                              >
                                Close map
                              </button>
                            </div>
                            <DetailTable details={device.details} />
                          </div>
                        )}
                      </article>
                    )
                  })}

                  {isEditing && devices.length === 0 && (
                    <button
                      className="launcher-empty-group"
                      type="button"
                      onClick={() => addDevice(group.id)}
                    >
                      Add the first device to {group.title}
                    </button>
                  )}
                </div>
              )}
            </section>
          )
        })
      )}

      {deviceDraft && (
        <div
          className="launcher-modal-backdrop"
          onMouseDown={() => setDeviceDraft(null)}
        >
          <form
            className="launcher-modal launcher-device-form"
            onSubmit={applyDeviceDraft}
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">DEVICE EDITOR</p>
                <h2>
                  {deviceDraft.mode === 'add'
                    ? 'Add device'
                    : 'Edit device'}
                </h2>
              </div>
              <button
                className="launcher-close"
                type="button"
                onClick={() => setDeviceDraft(null)}
              >
                ×
              </button>
            </header>

            <div className="launcher-form-fields">
              <label>
                Device name
                <input
                  required
                  value={deviceDraft.device.title}
                  onChange={event =>
                    updateDeviceDraft('title', event.target.value)
                  }
                />
              </label>

              <label>
                Device URL
                <input
                  required
                  value={deviceDraft.device.link}
                  onChange={event =>
                    updateDeviceDraft('link', event.target.value)
                  }
                />
              </label>

              <label>
                Group
                <select
                  value={deviceDraft.device.group}
                  onChange={event =>
                    updateDeviceDraft('group', event.target.value)
                  }
                >
                  {config.groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="launcher-checkbox-field">
                <input
                  type="checkbox"
                  checked={deviceDraft.hasMap}
                  onChange={event =>
                    setDeviceDraft(current =>
                      current
                        ? {
                            ...current,
                            hasMap: event.target.checked,
                          }
                        : current,
                    )
                  }
                />
                Include an expandable map
              </label>

              {deviceDraft.hasMap && (
                <>
                  <label>
                    Map title
                    <input
                      value={
                        deviceDraft.device.details?.title ?? ''
                      }
                      placeholder="Outlet map, speaker map, zone map…"
                      onChange={event =>
                        setDeviceDraft(current =>
                          current
                            ? {
                                ...current,
                                device: {
                                  ...current.device,
                                  details: {
                                    type:
                                      current.device.details?.type ??
                                      'map',
                                    title: event.target.value,
                                    rows:
                                      current.device.details?.rows ??
                                      [],
                                  },
                                },
                              }
                            : current,
                        )
                      }
                    />
                  </label>

                  <label>
                    Map rows
                    <textarea
                      rows={10}
                      value={deviceDraft.mapRowsText}
                      placeholder={
                        '1 | Rack fan\n2 | RTI power bar | XP-8V; PCM-4'
                      }
                      onChange={event =>
                        setDeviceDraft(current =>
                          current
                            ? {
                                ...current,
                                mapRowsText: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                    <small>
                      One row per line. Separate columns with | and
                      list items with semicolons.
                    </small>
                  </label>
                </>
              )}
            </div>

            <footer>
              <button
                type="button"
                onClick={() => setDeviceDraft(null)}
              >
                Cancel
              </button>
              <button
                className="launcher-primary-action"
                type="submit"
              >
                Apply
              </button>
            </footer>
          </form>
        </div>
      )}

      {groupDraft && (
        <div
          className="launcher-modal-backdrop"
          onMouseDown={() => setGroupDraft(null)}
        >
          <form
            className="launcher-modal launcher-group-form"
            onSubmit={applyGroupDraft}
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">GROUP EDITOR</p>
                <h2>
                  {groupDraft.mode === 'add'
                    ? 'Add group'
                    : 'Edit group'}
                </h2>
              </div>
              <button
                className="launcher-close"
                type="button"
                onClick={() => setGroupDraft(null)}
              >
                ×
              </button>
            </header>

            <div className="launcher-form-fields">
              <label>
                Group title
                <input
                  required
                  value={groupDraft.group.title}
                  onChange={event =>
                    setGroupDraft(current =>
                      current
                        ? {
                            ...current,
                            group: {
                              ...current.group,
                              title: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                />
              </label>

              <label>
                Accent colour
                <input
                  value={groupDraft.group.accent}
                  onChange={event =>
                    setGroupDraft(current =>
                      current
                        ? {
                            ...current,
                            group: {
                              ...current.group,
                              accent: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                />
              </label>
            </div>

            <footer>
              <button
                type="button"
                onClick={() => setGroupDraft(null)}
              >
                Cancel
              </button>
              <button
                className="launcher-primary-action"
                type="submit"
              >
                Apply
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  )

  function updateDeviceDraft(
    field: 'title' | 'link' | 'group',
    value: string,
  ) {
    setDeviceDraft(current =>
      current
        ? {
            ...current,
            device: {
              ...current.device,
              [field]: value,
            },
          }
        : current,
    )
  }
}

function createDeviceId(title: string) {
  const slug = slugify(title) || 'device'
  return `dev-${slug}-${crypto.randomUUID().slice(0, 8)}`
}

function createGroupId(
  title: string,
  existingGroups: LauncherGroup[],
) {
  const base = slugify(title) || 'group'
  const existingIds = new Set(
    existingGroups.map(group => group.id),
  )

  if (!existingIds.has(base)) return base

  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function serialiseRows(rows: DetailRow[]) {
  return rows
    .map(row =>
      row
        .map(cell =>
          Array.isArray(cell) ? cell.join('; ') : String(cell),
        )
        .join(' | '),
    )
    .join('\n')
}

function parseRows(value: string): DetailRow[] {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line =>
      line.split('|').map(rawCell => {
        const cell = rawCell.trim()

        if (cell.includes(';')) {
          return cell
            .split(';')
            .map(item => item.trim())
            .filter(Boolean)
        }

        return cell
      }),
    )
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error || `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

function formatDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString()
}
