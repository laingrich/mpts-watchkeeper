import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
} from 'react'
import type { ClientSettings } from '../clientSettings'
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

type DeviceReachability =
  | 'checking'
  | 'reachable'
  | 'unreachable'
  | 'not-checkable'
  | 'unknown'

type DeviceStatusResult = {
  id: string
  checkable: boolean
  reachable: boolean | null
  status: string
  message: string
  latencyMs?: number
}

type DeviceStatusResponse = {
  devices: DeviceStatusResult[]
  checkedAt: string
}

type ReachabilityHelperState = 'checking' | 'online' | 'offline'

type DeviceLauncherProps = {
  siteId: string
  siteName: string
  remoteSupport: ClientSettings['remoteSupport']
  onConfigureRemoteSupport?: () => void
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
const LOCAL_AGENT_URL = 'http://127.0.0.1:47831'

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

type RemoteSupportCardProps = {
  remoteSupport: ClientSettings['remoteSupport']
  onConfigure?: () => void
}

function RemoteSupportCard({
  remoteSupport,
  onConfigure,
}: RemoteSupportCardProps) {
  const details = getRemoteSupportDetails(remoteSupport)
  const statusLabel = remoteSupport.clientApprovalRequired
    ? 'Client approval required'
    : details.statusLabel

  return (
    <article className="launcher-card launcher-remote-access-card">
      <div className="launcher-card-main">
        <div className="launcher-card-copy">
          <p className="eyebrow">REMOTE ACCESS</p>
          <h3>
            {remoteSupport.computerName.trim() || 'Watchkeeper PC'}
          </h3>
          <span>{details.methodLabel}</span>
          <span
            className={`launcher-device-reachability ${
              details.configured ? 'not-checkable' : 'unknown'
            }`}
          >
            <span aria-hidden="true" />
            {statusLabel}
          </span>
          <p className="launcher-remote-access-note">
            {remoteSupport.instructions.trim() ||
              details.defaultInstructions}
          </p>
        </div>

        <div className="launcher-card-actions">
          {onConfigure && (
            <button type="button" onClick={onConfigure}>
              Configure access
            </button>
          )}

          {details.href ? (
            <a
              href={details.href}
              target={details.opensInBrowser ? '_blank' : undefined}
              rel={details.opensInBrowser ? 'noreferrer' : undefined}
            >
              {details.actionLabel}
            </a>
          ) : (
            <button
              className="launcher-open-device-disabled"
              type="button"
              disabled
              title={details.disabledReason}
            >
              {details.actionLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function getRemoteSupportDetails(
  remoteSupport: ClientSettings['remoteSupport'],
) {
  if (remoteSupport.method === 'chrome-remote-desktop') {
    return {
      methodLabel: 'Chrome Remote Desktop',
      statusLabel: 'Configured',
      defaultInstructions:
        'Open Chrome Remote Desktop and select this Watchkeeper PC.',
      configured: true,
      href: 'https://remotedesktop.google.com/access',
      actionLabel: 'Open remote desktop',
      disabledReason: '',
      opensInBrowser: true,
    }
  }

  if (remoteSupport.method === 'rustdesk') {
    const rustDeskId = remoteSupport.rustDeskId.trim()

    return {
      methodLabel: rustDeskId
        ? `RustDesk · ID ${rustDeskId}`
        : 'RustDesk',
      statusLabel: rustDeskId ? 'Configured' : 'RustDesk ID required',
      defaultInstructions: rustDeskId
        ? 'Open the installed RustDesk client and connect to this Watchkeeper PC.'
        : 'Add the Watchkeeper PC RustDesk ID in Site configuration.',
      configured: Boolean(rustDeskId),
      href: rustDeskId
        ? `rustdesk://connection/new/${encodeURIComponent(rustDeskId)}`
        : '',
      actionLabel: 'Open RustDesk',
      disabledReason:
        'Configure the RustDesk ID in Site configuration first.',
      opensInBrowser: false,
    }
  }

  const methodLabels: Record<
    ClientSettings['remoteSupport']['method'],
    string
  > = {
    none: 'Remote access not configured',
    'windows-rdp': 'Windows Remote Desktop',
    'chrome-remote-desktop': 'Chrome Remote Desktop',
    rustdesk: 'RustDesk',
    teamviewer: 'TeamViewer',
    'quick-assist': 'Microsoft Quick Assist',
    other: 'Other remote-support method',
  }

  return {
    methodLabel: methodLabels[remoteSupport.method],
    statusLabel:
      remoteSupport.method === 'none' ? 'Not configured' : 'Configured',
    defaultInstructions:
      remoteSupport.method === 'none'
        ? 'Choose Chrome Remote Desktop or RustDesk in Site configuration.'
        : 'Follow the support instructions configured for this site.',
    configured: remoteSupport.method !== 'none',
    href: '',
    actionLabel:
      remoteSupport.method === 'none'
        ? 'Remote access unavailable'
        : 'Follow instructions',
    disabledReason:
      remoteSupport.method === 'none'
        ? 'Configure remote access in Site configuration first.'
        : 'This remote-support method does not have a direct launch action.',
    opensInBrowser: false,
  }
}

export default function DeviceLauncher({
  siteId: clientId,
  siteName: clientName,
  remoteSupport,
  onConfigureRemoteSupport,
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
  const [deviceReachability, setDeviceReachability] = useState<
    Record<string, DeviceReachability>
  >({})
  const [reachabilityMessages, setReachabilityMessages] = useState<
    Record<string, string>
  >({})
  const [reachabilityHelper, setReachabilityHelper] =
    useState<ReachabilityHelperState>('checking')
  const [reachabilityCheckedAt, setReachabilityCheckedAt] =
    useState<string | null>(null)

  useEffect(() => {
    void loadConfig()
  }, [clientId])

  useEffect(() => {
    if (!config) return

    let cancelled = false
    let intervalId: number | null = null

    async function checkDevices() {
      if (!config) return

      const networkDevices = config.devices.filter(device =>
        /^https?:\/\//i.test(device.link),
      )

      setDeviceReachability(current => {
        const next = { ...current }

        for (const device of networkDevices) {
          if (!next[device.id] || next[device.id] === 'unknown') {
            next[device.id] = 'checking'
          }
        }

        for (const device of config.devices) {
          if (!/^https?:\/\//i.test(device.link)) {
            next[device.id] = 'not-checkable'
          }
        }

        return next
      })

      if (networkDevices.length === 0) {
        setReachabilityHelper('online')
        setReachabilityCheckedAt(new Date().toISOString())
        return
      }

      try {
        const response = await fetch(`${LOCAL_AGENT_URL}/devices/status`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({
            clientId,
            clientName,
            devices: networkDevices.map(device => ({
              id: device.id,
              link: device.link,
            })),
          }),
        })

        if (!response.ok) {
          throw new Error(`Local helper returned ${response.status}`)
        }

        const data = (await response.json()) as DeviceStatusResponse

        if (cancelled) return

        const statuses: Record<string, DeviceReachability> = {}
        const messages: Record<string, string> = {}

        for (const device of config.devices) {
          if (!/^https?:\/\//i.test(device.link)) {
            statuses[device.id] = 'not-checkable'
          }
        }

        for (const result of data.devices) {
          statuses[result.id] = result.checkable
            ? result.reachable
              ? 'reachable'
              : 'unreachable'
            : 'not-checkable'
          messages[result.id] = result.message
        }

        setDeviceReachability(statuses)
        setReachabilityMessages(messages)
        setReachabilityHelper('online')
        setReachabilityCheckedAt(data.checkedAt)
      } catch {
        if (cancelled) return

        const statuses: Record<string, DeviceReachability> = {}

        for (const device of config.devices) {
          statuses[device.id] = /^https?:\/\//i.test(device.link)
            ? 'unknown'
            : 'not-checkable'
        }

        setDeviceReachability(statuses)
        setReachabilityMessages({})
        setReachabilityHelper('offline')
        setReachabilityCheckedAt(null)
      }
    }

    setReachabilityHelper('checking')
    void checkDevices()
    intervalId = window.setInterval(() => void checkDevices(), 15_000)

    return () => {
      cancelled = true
      if (intervalId !== null) window.clearInterval(intervalId)
    }
  }, [clientId, clientName, config])

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
    const remoteAccessMatches =
      !normalised ||
      [
        'Watchkeeper PC',
        'remote access',
        'Chrome Remote Desktop',
        'RustDesk',
        remoteSupport.method,
        remoteSupport.computerName,
        remoteSupport.rustDeskId,
        remoteSupport.instructions,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalised)

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

        return {
          group,
          devices,
          showRemoteAccessCard:
            group.id === 'management' && remoteAccessMatches,
        }
      })
      .filter(
        item =>
          item.devices.length > 0 ||
          item.showRemoteAccessCard ||
          isEditing,
      )
  }, [config, query, isEditing, remoteSupport])

  const reachabilitySummary = useMemo(() => {
    if (!config) return 'Checking device availability…'

    if (reachabilityHelper === 'offline') {
      return 'Device availability is unavailable because the local Watchkeeper helper is not running.'
    }

    if (reachabilityHelper === 'checking') {
      return 'Checking which devices are reachable from this computer…'
    }

    const checkableDevices = config.devices.filter(device =>
      /^https?:\/\//i.test(device.link),
    )
    const reachableDevices = checkableDevices.filter(
      device => deviceReachability[device.id] === 'reachable',
    )

    const checkedText = reachabilityCheckedAt
      ? ` Last checked ${new Date(reachabilityCheckedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}.`
      : ''

    return `${reachableDevices.length} of ${checkableDevices.length} devices reachable from this computer. Access may be direct on the site network or through VPN.${checkedText}`
  }, [
    config,
    deviceReachability,
    reachabilityCheckedAt,
    reachabilityHelper,
  ])

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

      <p className="launcher-network-note" aria-live="polite">
        {reachabilitySummary}
      </p>

      {visibleGroups.length === 0 ? (
        <article className="panel empty-state">
          <h3>No matching devices</h3>
          <p>Try another device, group, room, zone or outlet.</p>
        </article>
      ) : (
        visibleGroups.map(({ group, devices, showRemoteAccessCard }, groupIndex) => {
          const collapsed = collapsedGroups.has(group.id)
          const itemCount =
            devices.length + (showRemoteAccessCard ? 1 : 0)

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
                  <small>
                    {itemCount}{' '}
                    {showRemoteAccessCard ? 'items' : 'devices'}
                  </small>
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
                  {showRemoteAccessCard && (
                    <RemoteSupportCard
                      remoteSupport={remoteSupport}
                      onConfigure={onConfigureRemoteSupport}
                    />
                  )}

                  {devices.map(device => {
                    const mapOpen = expandedMaps.has(device.id)
                    const reachability =
                      deviceReachability[device.id] ?? 'checking'
                    const canOpenDevice =
                      reachability === 'reachable' ||
                      reachability === 'not-checkable'
                    const reachabilityLabel =
                      reachability === 'reachable'
