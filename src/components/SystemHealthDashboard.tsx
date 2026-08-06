import type { ClientSettings } from '../clientSettings'
import IntegrationDashboard from './IntegrationDashboard'

type SystemHealthDashboardProps = {
  clientId: string
  clientName: string
  monitoring: ClientSettings['monitoring']
  integrations: ClientSettings['integrations']
  discovery?: ClientSettings['discovery']
  onConfigureMonitoring?: () => void
}

export default function SystemHealthDashboard({
  clientId,
  clientName,
  monitoring,
  integrations,
  discovery,
  onConfigureMonitoring,
}: SystemHealthDashboardProps) {
  return (
    <IntegrationDashboard
      clientId={clientId}
      clientName={clientName}
      monitoring={monitoring}
      integrations={integrations}
      discovery={
        discovery ?? {
          domotzEnabled: false,
          unifiEnabled: false,
          watchkeeperAgentEnabled: false,
          subnet: '',
        }
      }
      onConfigureMonitoring={onConfigureMonitoring}
    />
  )
}
