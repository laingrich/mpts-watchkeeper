import {
  useState,
  type FormEvent,
} from 'react'
import './WorkflowForms.css'

type ServiceReportFormProps = {
  clientId: string
  clientName: string
}

type ServiceReportState = {
  visitDate: string
  arrivalTime: string
  departureTime: string
  technician: string
  jetbuiltReference: string
  visitReason: string
  workCompleted: string
  systemsChanged: string
  partsUsed: string
  outcome: string
  followUp: string
  clientContact: string
}

type StoredMockReport = ServiceReportState & {
  reference: string
  clientId: string
  clientName: string
  createdAt: string
}

function today() {
  const now = new Date()
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  )
  return local.toISOString().slice(0, 10)
}

function emptyReport(): ServiceReportState {
  return {
    visitDate: today(),
    arrivalTime: '',
    departureTime: '',
    technician: '',
    jetbuiltReference: '',
    visitReason: '',
    workCompleted: '',
    systemsChanged: '',
    partsUsed: '',
    outcome: 'Work completed',
    followUp: '',
    clientContact: '',
  }
}

export default function ServiceReportForm({
  clientId,
  clientName,
}: ServiceReportFormProps) {
  const [form, setForm] = useState<ServiceReportState>(emptyReport)
  const [submittedReference, setSubmittedReference] =
    useState<string | null>(null)

  function updateField<Key extends keyof ServiceReportState>(
    key: Key,
    value: ServiceReportState[Key],
  ) {
    setForm(current => ({
      ...current,
      [key]: value,
    }))
    setSubmittedReference(null)
  }

  function clearForm() {
    setForm(emptyReport())
    setSubmittedReference(null)
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const reference = `SR-MOCK-${Date.now()
      .toString()
      .slice(-7)}`

    const report: StoredMockReport = {
      ...form,
      reference,
      clientId,
      clientName,
      createdAt: new Date().toISOString(),
    }

    try {
      const storageKey = `watchkeeper.mockServiceReports.${clientId}`
      const existing = JSON.parse(
        window.localStorage.getItem(storageKey) || '[]',
      ) as unknown
      const reports = Array.isArray(existing) ? existing : []

      window.localStorage.setItem(
        storageKey,
        JSON.stringify([report, ...reports]),
      )
    } catch {
      // The mock confirmation still displays if local storage is blocked.
    }

    setSubmittedReference(reference)
  }

  return (
    <section className="workflow-page">
      <header className="workflow-page-header">
        <div>
          <p className="eyebrow">SERVICE REPORT</p>
          <h3>Submit a service report</h3>
          <p>
            Record work completed for {clientName} in a format ready for
            future submission to Jetbuilt.
          </p>
        </div>

        <span className="workflow-integration-badge">
          Jetbuilt upload: planned
        </span>
      </header>

      <form className="panel workflow-form" onSubmit={submitReport}>
        {submittedReference && (
          <div className="workflow-success" role="status">
            Mock service report {submittedReference} has been saved
            locally. No information was sent to Jetbuilt.
          </div>
        )}

        <div className="workflow-warning">
          This form currently saves a test copy in the browser. The final
          integration will attach the report to the selected Jetbuilt
          client, project or service case.
        </div>

        <section className="workflow-form-section">
          <h4>Visit information</h4>

          <div className="workflow-form-grid three">
            <div className="workflow-field">
              <label htmlFor="report-date">Visit date</label>
              <input
                id="report-date"
                type="date"
                required
                value={form.visitDate}
                onChange={event =>
                  updateField('visitDate', event.target.value)
                }
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="report-arrival">Arrival time</label>
              <input
                id="report-arrival"
                type="time"
                value={form.arrivalTime}
                onChange={event =>
                  updateField('arrivalTime', event.target.value)
                }
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="report-departure">Departure time</label>
              <input
                id="report-departure"
                type="time"
                value={form.departureTime}
                onChange={event =>
                  updateField('departureTime', event.target.value)
                }
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="report-technician">Technician</label>
              <input
                id="report-technician"
                required
                value={form.technician}
                onChange={event =>
                  updateField('technician', event.target.value)
                }
                placeholder="Engineer completing the report"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="report-reference">
                Jetbuilt project/service reference
              </label>
              <input
                id="report-reference"
                value={form.jetbuiltReference}
                onChange={event =>
                  updateField('jetbuiltReference', event.target.value)
                }
                placeholder="Optional during mock stage"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="report-contact">Client contact</label>
              <input
                id="report-contact"
                value={form.clientContact}
                onChange={event =>
                  updateField('clientContact', event.target.value)
                }
                placeholder="Person briefed or present"
              />
            </div>
          </div>
        </section>

        <section className="workflow-form-section">
          <h4>Work carried out</h4>

          <div className="workflow-form-grid">
            <div className="workflow-field full-width">
              <label htmlFor="report-reason">Reason for visit</label>
              <textarea
                id="report-reason"
                required
                value={form.visitReason}
                onChange={event =>
                  updateField('visitReason', event.target.value)
                }
                placeholder="Reported fault, planned maintenance or requested change"
              />
            </div>

            <div className="workflow-field full-width">
              <label htmlFor="report-work">Work completed</label>
              <textarea
                id="report-work"
                required
                value={form.workCompleted}
                onChange={event =>
                  updateField('workCompleted', event.target.value)
                }
                placeholder="Diagnosis, repairs, tests and configuration changes"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="report-systems">Systems/files changed</label>
              <textarea
                id="report-systems"
                value={form.systemsChanged}
                onChange={event =>
                  updateField('systemsChanged', event.target.value)
                }
                placeholder="Processors, programs, firmware, network settings and backups"
              />
            </div>

            <div className="workflow-field">
              <label htmlFor="report-parts">Parts and materials</label>
              <textarea
                id="report-parts"
                value={form.partsUsed}
                onChange={event =>
                  updateField('partsUsed', event.target.value)
                }
                placeholder="Installed, replaced, ordered or returned items"
              />
            </div>
          </div>
        </section>

        <section className="workflow-form-section">
          <h4>Outcome and follow-up</h4>

          <div className="workflow-form-grid">
            <div className="workflow-field">
              <label htmlFor="report-outcome">Visit outcome</label>
              <select
                id="report-outcome"
                value={form.outcome}
                onChange={event =>
                  updateField('outcome', event.target.value)
                }
              >
                <option>Work completed</option>
                <option>Monitoring required</option>
                <option>Further remote work required</option>
                <option>Return visit required</option>
                <option>Awaiting parts</option>
                <option>Escalated to manufacturer</option>
              </select>
            </div>

            <div className="workflow-field">
              <label htmlFor="report-follow-up">Follow-up actions</label>
              <textarea
                id="report-follow-up"
                value={form.followUp}
                onChange={event =>
                  updateField('followUp', event.target.value)
                }
                placeholder="Owner, due date and next action"
              />
            </div>
          </div>
        </section>

        <footer className="workflow-form-actions">
          <p className="workflow-form-note">
            A future version can generate a PDF, update a Jetbuilt service
            case and attach photographs or supporting files.
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
              Submit service report (mock)
            </button>
          </div>
        </footer>
      </form>
    </section>
  )
}
