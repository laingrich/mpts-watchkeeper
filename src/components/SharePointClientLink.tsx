import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import {
  normaliseClientSettings,
  type ClientSettings,
  type ClientSettingsResponse,
} from '../clientSettings'
import './SharePointClientLink.css'

type SharePointClientLinkProps = {
  clientId: string
  clientName: string
  onSettingsChanged?: (settings: ClientSettings) => void
}

type DocumentSource = 'sharepoint' | 'artura'

export default function SharePointClientLink({
  clientId,
  clientName,
  onSettingsChanged,
}: SharePointClientLinkProps) {
  const [settings, setSettings] =
    useState<ClientSettings>(() => normaliseClientSettings(null))
  const [editingSource, setEditingSource] =
    useState<DocumentSource | null>(null)
  const [draftUrl, setDraftUrl] = useState('')
  const [etag, setEtag] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadSettings()
  }, [clientId])

  async function loadSettings() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/client-settings/${encodeURIComponent(clientId)}`,
        { headers: { Accept: 'application/json' } },
      )

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data = (await response.json()) as ClientSettingsResponse
      const normalised = normaliseClientSettings(data.settings)

      setSettings(normalised)
      onSettingsChanged?.(normalised)
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
      setEditingSource(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load client document settings',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function beginEditing(source: DocumentSource) {
    setEditingSource(source)
    setDraftUrl(
      source === 'sharepoint'
        ? settings.sharePointUrl
        : settings.arturaUrl,
    )
    setError(null)
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingSource) return

    setIsSaving(true)
    setError(null)

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      if (etag) headers['If-Match'] = etag

      const body =
        editingSource === 'sharepoint'
          ? { sharePointUrl: draftUrl.trim() }
          : { arturaUrl: draftUrl.trim() }

      const response = await fetch(
        `/api/client-settings/${encodeURIComponent(clientId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        },
      )

      if (response.status === 409) {
        throw new Error(
          'Another user changed these settings. Reload before saving again.',
        )
      }

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data = (await response.json()) as ClientSettingsResponse
      const normalised = normaliseClientSettings(data.settings)

      setSettings(normalised)
      onSettingsChanged?.(normalised)
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
      setEditingSource(null)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save the document link',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="panel empty-state">
        <h3>Loading document sources</h3>
        <p>Retrieving document settings for {clientName}…</p>
      </section>
    )
  }

  return (
    <section className="document-sources-page">
      <header className="document-sources-header">
        <div>
          <p className="eyebrow">DOCUMENTS</p>
          <h3>{clientName}</h3>
          <p>
            Open the authoritative project documentation in SharePoint or
            Artura. Watchkeeper stores only the links.
          </p>
        </div>
        {updatedAt && (
          <small>
            Links updated {formatDate(updatedAt)}
            {updatedBy ? ` by ${updatedBy}` : ''}
          </small>
        )}
      </header>

      <div className="document-source-grid">
        <DocumentSourceCard
          source="sharepoint"
          eyebrow="SHAREPOINT"
          title="Files and site records"
          url={settings.sharePointUrl}
          openLabel="Open client documents in SharePoint"
          emptyMessage="No SharePoint folder link has been configured for this client yet."
          description="Drawings, manuals, reports, backups and other controlled project files."
          note={
            <>
              In SharePoint, select <strong>Add shortcut to OneDrive</strong> to
              make the folder available in Finder or File Explorer.
            </>
          }
          editingSource={editingSource}
          draftUrl={draftUrl}
          isSaving={isSaving}
          onEdit={beginEditing}
          onDraftUrlChange={setDraftUrl}
          onCancel={() => {
            setEditingSource(null)
            setError(null)
          }}
          onSave={saveSettings}
        />

        <DocumentSourceCard
          source="artura"
          eyebrow="ARTURA"
          title="Design and engineering"
          url={settings.arturaUrl}
          openLabel="Open project in Artura"
          emptyMessage="No Artura project link has been configured for this client yet."
          description="System design, schematics, products, cables and installation engineering."
          note="Use the client-specific project URL when available; the main Artura application link is used by default."
          editingSource={editingSource}
          draftUrl={draftUrl}
          isSaving={isSaving}
          onEdit={beginEditing}
          onDraftUrlChange={setDraftUrl}
          onCancel={() => {
            setEditingSource(null)
            setError(null)
          }}
          onSave={saveSettings}
        />
      </div>

      {error && (
        <div className="sharepoint-link-error" role="alert">
          {error}
        </div>
      )}
    </section>
  )
}

type DocumentSourceCardProps = {
  source: DocumentSource
  eyebrow: string
  title: string
  url: string
  openLabel: string
  emptyMessage: string
  description: string
  note: React.ReactNode
  editingSource: DocumentSource | null
  draftUrl: string
  isSaving: boolean
  onEdit: (source: DocumentSource) => void
  onDraftUrlChange: (url: string) => void
  onCancel: () => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
}

function DocumentSourceCard({
  source,
  eyebrow,
  title,
  url,
  openLabel,
  emptyMessage,
  description,
  note,
  editingSource,
  draftUrl,
  isSaving,
  onEdit,
  onDraftUrlChange,
  onCancel,
  onSave,
}: DocumentSourceCardProps) {
  const isEditing = editingSource === source

  return (
    <article className="panel document-source-card">
      <div className="sharepoint-client-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h4>{title}</h4>
        <p>{url ? description : emptyMessage}</p>
        <p className="sharepoint-onedrive-note">{note}</p>
      </div>

      {!isEditing && (
        <div className="sharepoint-client-actions">
          {url && (
            <a
              className="sharepoint-open-button"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {openLabel}
            </a>
          )}
          <button
            className="sharepoint-edit-button"
            type="button"
            onClick={() => onEdit(source)}
          >
            {url ? 'Edit link' : 'Add link'}
          </button>
        </div>
      )}

      {isEditing && (
        <form className="sharepoint-link-editor" onSubmit={onSave}>
          <label>
            {source === 'sharepoint'
              ? 'SharePoint folder URL'
              : 'Artura project URL'}
            <input
              type="url"
              value={draftUrl}
              placeholder={
                source === 'sharepoint'
                  ? 'https://tenant.sharepoint.com/sites/...'
                  : 'https://app.artura.io'
              }
              onChange={event => onDraftUrlChange(event.target.value)}
            />
          </label>

          <div>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="sharepoint-save-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save link'}
            </button>
          </div>
        </form>
      )}
    </article>
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
