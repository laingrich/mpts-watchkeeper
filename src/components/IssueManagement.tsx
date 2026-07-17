import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import './WorkflowForms.css'

type IssueManagementProps = {
  clientId: string
  clientName: string
}

type IssueFormState = {
  summary: string
  category: string
  priority: string
  affectedSystem: string
  customerImpact: string
  description: string
  troubleshooting: string
  requestedAction: string
  status: string
  assignedTo: string
}

type StoredMockIssue = IssueFormState & {
  reference: string
  clientId: string
  clientName: string
  createdAt: string
}

const emptyIssue: IssueFormState = {
  summary: '',
  category: 'System fault',
  priority: 'Normal',
  affectedSystem: '',
  customerImpact: 'Limited impact',
  description: '',
  troubleshooting: '',
  requestedAction: '',
  status: 'Open',
  assignedTo: '',
}

export default function IssueManagement({
  clientId,
  clientName,
}: IssueManagementProps) {
  const [form, setForm] = useState<IssueFormState>(emptyIssue)
  const [submittedReference, setSubmittedReference] =
    useState<string | null>(null)
  const [mockIssueCount, setMockIssueCount] = useState(0)

  const storageKey = `watchkeeper.mockIssues.${clientId}`

  useEffect(() => {
    setSubmittedReference(null)

    try {
      const stored = JSON.parse(
        window.localStorage.getItem(storageKey) || '[]',
      ) as unknown

      setMockIssueCount(Array.isArray(stored) ? stored.length : 0)
    } catch {
      setMockIssueCount(0)
    }
  }, [storageKey])

  function updateField<Key extends keyof IssueFormState>(
    key: Key,
    value: IssueFormState[Key],
  ) {
    setForm(current => ({
      ...current,
      [key]: value,
    }))
    setSubmittedReference(null)
  }

  function clearForm() {
    setForm(emptyIssue)
    setSubmittedReference(null)
  }

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const reference = `JB-MOCK-${Date.now()
      .toString()
      .slice(-7)}`

    const issue: StoredMockIssue = {
      ...form,
      reference,
      clientId,
      clientName,
      createdAt: new Date().toISOString(),
    }

    try {
      const existing = JSON.parse(
        window.localStorage.getItem(storageKey) || '[]',
      ) as unknown

      const issues = Array.isArray(existing) ? existing : []
      window.localStorage.setItem(
        storageKey,
        JSON.stringify([issue, ...issues]),
      )
      setMockIssueCount(issues.length + 1)
    } catch {
      // The mock confirmation still displays if local storage is blocked.
    }

    setSubmittedReference(reference)
  }

  return (
    <section className="workflow-page">
      <header className="workflow-page-header">
        <div>
          <p className="eyebrow">ISSUE MANAGEMENT</p>
          <h3>Submit an issue for {clientName}</h3>
          <p>
            Capture a structured support issue ready for a future
            Jetbuilt service-case integration.
          </p>
        </div>

        <span className="workflow-integration-badge">
          Jetbuilt submission: mock
        </span>
      </header>

      <div className="workflow-summary-grid">
        <article className="workflow-summary-card">
          <small>MOCK ISSUES SAVED</small>
          <strong>{mockIssueCount}</strong>
          <span>Stored in this browser only</span>
        </article>

        <article className="workflow-summary-card">
          <small>JETBUILT CONNECTION</small>
          <strong>Read only</strong>
          <span>Issue write endpoint not enabled</span>
        </article>

        <article className="workflow-summary-card">
          <small>DEFAULT WORKFLOW</small>
          <strong>Open</strong>
          <span>Engineer review and assignment</span>
        </article>
      </div>

      <form className="panel workflow-form" onSubmit={submitIssue}>
        {submittedReference && (
          <div className="workflow-success" role="status">
            Mock issue {submittedReference} has been saved locally. No
            information was sent to Jetbuilt.
          </div>
        )}

        <div className="workflow-warning">
          This is a working interface mock-up. The final submission will
          create or update the corresponding Jetbuilt service record.
        </div>

        <section className="workflow-form-section">
          <h4>Issue details</h4>

          <div className="workflow-form-grid">
            <div className="workflow-field full-width">
              <label htmlFor="issue-summary">Issue summary</label>
              <input
                id="issue-summary"
                required
                value={form.summary}
                onChange={event =>
                  updateField('summary', event.target.value)
                }
                placeholder="For example: Cinema projector does not start"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="issue-category">Category</label>
              <select
                id="issue-category"
                value={form.category}
                onChange={event =>
                  updateField('category', event.target.value)
                }
              >
                <option>System fault</option>
                <option>Network</option>
                <option>Audio / video</option>
                <option>Control system</option>
                <option>Power / UPS</option>
                <option>Configuration request</option>
                <option>Preventative maintenance</option>
              </select>
            </div>

            <div className="workflow-field">
              <label htmlFor="issue-priority">Priority</label>
              <select
                id="issue-priority"
                value={form.priority}
                onChange={event =>
                  updateField('priority', event.target.value)
                }
              >
                <option>Low</option>
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </div>

            <div className="workflow-field">
              <label htmlFor="issue-system">Affected system/device</label>
              <input
                id="issue-system"
                value={form.affectedSystem}
                onChange={event =>
                  updateField('affectedSystem', event.target.value)
                }
                placeholder="Device, room or subsystem"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="issue-impact">Customer impact</label>
              <select
                id="issue-impact"
                value={form.customerImpact}
                onChange={event =>
                  updateField('customerImpact', event.target.value)
                }
              >
                <option>No current impact</option>
                <option>Limited impact</option>
                <option>Major loss of service</option>
                <option>Complete system outage</option>
                <option>Safety or security concern</option>
              </select>
            </div>
          </div>
        </section>

        <section className="workflow-form-section">
          <h4>Description and diagnosis</h4>

          <div className="workflow-form-grid">
            <div className="workflow-field full-width">
              <label htmlFor="issue-description">Issue description</label>
              <textarea
                id="issue-description"
                required
                value={form.description}
                onChange={event =>
                  updateField('description', event.target.value)
                }
                placeholder="What was reported, when it started and how the fault presents"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="issue-troubleshooting">
                Troubleshooting completed
              </label>
              <textarea
                id="issue-troubleshooting"
                value={form.troubleshooting}
                onChange={event =>
                  updateField('troubleshooting', event.target.value)
                }
                placeholder="Checks, reboots, measurements and observations"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="issue-action">Requested next action</label>
              <textarea
                id="issue-action"
                value={form.requestedAction}
                onChange={event =>
                  updateField('requestedAction', event.target.value)
                }
                placeholder="Remote investigation, parts required, site visit, monitoring…"
              />
            </div>
          </div>
        </section>

        <section className="workflow-form-section">
          <h4>Jetbuilt workflow fields</h4>

          <div className="workflow-form-grid">
            <div className="workflow-field">
              <label htmlFor="issue-status">Status</label>
              <select
                id="issue-status"
                value={form.status}
                onChange={event =>
                  updateField('status', event.target.value)
                }
              >
                <option>Open</option>
                <option>Investigating</option>
                <option>Awaiting client</option>
                <option>Awaiting parts</option>
                <option>Resolved</option>
              </select>
            </div>

            <div className="workflow-field">
              <label htmlFor="issue-assignee">Assigned engineer</label>
              <input
                id="issue-assignee"
                value={form.assignedTo}
                onChange={event =>
                  updateField('assignedTo', event.target.value)
                }
                placeholder="Optional at submission"
              />
            </div>
          </div>
        </section>

        <footer className="workflow-form-actions">
          <p className="workflow-form-note">
            The mock record is retained only in this browser so the form
            can be tested without writing to Jetbuilt.
          </p>

          <div>
            <button
              className="workflow-secondary-button"
              type="button"
              onClick={clearForm}
            >
              Clear form
            </button>

            <button className="workflow-primary-button" type="submit">
              Submit to Jetbuilt (mock)
            </button>
          </div>
        </footer>
      </form>
    </section>
  )
}
