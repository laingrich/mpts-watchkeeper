import type { ClientSettings } from '../clientSettings'
import IntegrationDashboard from './IntegrationDashboard'

type SystemHealthDashboardProps = {
  clientName: string
  configuredDeviceCount: number
  onOpenDevices: () => void
  monitoring: ClientSettings['monitoring']
  discovery?: ClientSettings['discovery']
}

export default function SystemHealthDashboard({
  clientName,
  configuredDeviceCount,
  onOpenDevices,
  monitoring,
  discovery,
}: SystemHealthDashboardProps) {
  return (
    <IntegrationDashboard
      clientName={clientName}
      configuredDeviceCount={configuredDeviceCount}
      monitoring={monitoring}
      discovery={
        discovery ?? {
          domotzEnabled: false,
          unifiEnabled: false,
          watchkeeperAgentEnabled: false,
          subnet: '',
        }
      }
      onOpenDevices={onOpenDevices}
    />
  )
}
