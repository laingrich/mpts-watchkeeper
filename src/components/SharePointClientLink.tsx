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

export default function SharePointClientLink({
  clientId,
  clientName,
  onSettingsChanged,
}: SharePointClientLinkProps) {
  const [settings, setSettings] =
    useState<ClientSettings>(() =>
      normaliseClientSettings(null),
    )
  const [draftUrl, setDraftUrl] = useState('')
  const [etag, setEtag] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] =
    useState<string | null>(null)
  const [updatedBy, setUpdatedBy] =
    useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
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
        `/api/client-settings/${encodeURIComponent(
          clientId
        )}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data =
        (await response.json()) as ClientSettingsResponse

      const normalised = normaliseClientSettings(data.settings)
      setSettings(normalised)
      setDraftUrl(normalised.sharePointUrl)
      onSettingsChanged?.(normalised)
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
      setIsEditing(false)
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

  async function saveSettings(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
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
        `/api/client-settings/${encodeURIComponent(
          clientId
        )}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            sharePointUrl: draftUrl.trim(),
          }),
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

      const data =
        (await response.json()) as ClientSettingsResponse

      const normalised = normaliseClientSettings(data.settings)
      setSettings(normalised)
      setDraftUrl(normalised.sharePointUrl)
      onSettingsChanged?.(normalised)
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
      setIsEditing(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save the SharePoint link',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="panel empty-state">
        <h3>Loading document link</h3>
        <p>Retrieving document settings for {clientName}…</p>
      </section>
    )
  }

  return (
    <section className="panel sharepoint-client-card">
      <div className="sharepoint-client-copy">
        <p className="eyebrow">SHAREPOINT DOCUMENTS</p>
        <h3>{clientName}</h3>

        {settings.sharePointUrl ? (
          <>
            <p>
              Open the client’s SharePoint folder using your
              normal Microsoft 365 account.
            </p>

            <p className="sharepoint-onedrive-note">
              In SharePoint, select <strong>Add shortcut to OneDrive</strong>
              to make this folder available in Finder or File Explorer.
            </p>
          </>
        ) : (
          <p>
            No SharePoint folder link has been configured for this
            client yet.
          </p>
        )}

        {updatedAt && (
          <small className="sharepoint-client-meta">
            Last updated {formatDate(updatedAt)}
            {updatedBy ? ` by ${updatedBy}` : ''}
          </small>
        )}
      </div>

      <div className="sharepoint-client-actions">
        {settings.sharePointUrl && !isEditing && (
          <a
            className="sharepoint-open-button"
            href={settings.sharePointUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open client documents in SharePoint
          </a>
        )}

        {!isEditing && (
          <button
            className="sharepoint-edit-button"
            type="button"
            onClick={() => {
              setDraftUrl(settings.sharePointUrl)
              setIsEditing(true)
            }}
          >
            {settings.sharePointUrl
              ? 'Edit folder link'
              : 'Add folder link'}
          </button>
        )}
      </div>

      {isEditing && (
        <form
          className="sharepoint-link-editor"
          onSubmit={saveSettings}
        >
          <label>
            SharePoint folder URL
            <input
              type="url"
              value={draftUrl}
              placeholder="https://mptechnicals.sharepoint.com/sites/Projects/..."
              onChange={event =>
                setDraftUrl(event.target.value)
              }
            />
          </label>

          <div>
            <button
              type="button"
              onClick={() => {
                setDraftUrl(settings.sharePointUrl)
                setIsEditing(false)
                setError(null)
              }}
            >
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

      {error && (
        <div className="sharepoint-link-error">
          {error}
        </div>
      )}
    </section>
  )
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: string
    }

    return (
      body.error ||
      `Request failed with status ${response.status}`
    )
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
