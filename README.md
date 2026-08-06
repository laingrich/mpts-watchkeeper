# MPTS Watchkeeper MVP

Initial deployable frontend for Azure Static Web Apps.

## Included

- Saltmarsh House site view
- Overview, Devices, Documents and Service sections
- Cross-device user preferences for the last client, tab and client picker
- Searchable device launcher
- Responsive desktop/mobile layout
- Static Web Apps navigation fallback
- Data kept separately in `src/data/sites.json`

## Run locally

1. Install Node.js LTS.
2. Open a terminal in this folder.
3. Run:

   npm install
   npm run dev

For the full local API environment, set `WATCHKEEPER_USER_PREFERENCES_CONTAINER`
in `api/local.settings.json` to a development-only container name.

### GUDE IPPDU control

Watchkeeper shows live GUDE power-port state and provides confirmed **On**,
**Off** and **Reset** actions through the Domotz Public API. The browser calls
Watchkeeper's authenticated API; only the server holds the Domotz API key.
Switching therefore works from an authorised browser without the retired GUDE
loopback helper or direct access to the site's private network.

The GUDE-discovered outlet name and the Domotz-reported switching state are
displayed as read-only operational data. Watchkeeper does not maintain a second
outlet-name map and does not rename outlets. Rename an outlet in the GUDE browser
interface when required; Watchkeeper displays the updated name on a subsequent
refresh. Port state refreshes automatically every 15 seconds and immediately
after each switching command.

All three Watchkeeper roles can operate power for clients they are authorised
to access. Administrators and engineers can access managed clients. An operator
can operate power only for the clients explicitly assigned to that account by
`WATCHKEEPER_OPERATOR_CLIENT_ACCESS`. Every action requires a confirmation in
the UI and the server records the actor, client, device, outlet and outcome in
the Watchkeeper application log. There is no separate protected-port list.

A normal Watchkeeper device can carry a `powerOutlet` relationship containing
only a GUDE Watchkeeper device ID and port number. Its device card then shows a
compact **Power** action with the same confirmed toggle and Reset controls. The
live outlet name and state still come from the GUDE; Watchkeeper does not match
devices to outlets by editable name. The Saltmarsh seed currently includes only
the unambiguous AD1616 #2, AD1616 #3 and Cinema AVR relationships. Shared or
uncertain outlets must be verified before adding a relationship, because a
device-level power action must not imply that a shared outlet affects only one
device.

Every other non-GUDE device card also shows **Power**. For administrators and
engineers, opening an unassigned Power panel reads all configured GUDE outlets,
supports search by GUDE, outlet name or port, and saves the selected device/port
relationship after confirmation. Outlets already assigned to another
Watchkeeper device are shown but cannot be selected. Operators can use mapped
power controls but cannot create or change these engineering relationships; an
unmapped Power button is disabled for them. Assignment updates Watchkeeper only
and never changes a GUDE outlet name or switching state.

Configure `WATCHKEEPER_OPERATOR_CLIENT_ACCESS` in `api/local.settings.json` for
local full-stack development and as an Azure Static Web Apps application
setting. It is a JSON object mapping
each operator's lower-case Entra user ID or email address to the Jetbuilt client
IDs they may access, for example:

```json
{"homeowner@example.com":["replace-with-jetbuilt-client-id"]}
```

Assign that person the `watchkeeper_operator` Static Web Apps role. An operator
with no valid mapping sees no clients and cannot use the power API.

The server-side Watchkeeper-to-Domotz device references are in
`api/src/data/domotzPowerDevices.json`. They contain only stable external IDs and
verified models, not credentials. The Collector ID comes from the client's
existing Domotz integration setting. Changing an API setting requires restarting
the local API or restarting/redeploying the Azure application. The separate
onsite agent on `127.0.0.1:47831` remains available for VPN launching and local
device-reachability checks; GUDE power control does not depend on it.

### Domotz integration

Watchkeeper associates a Jetbuilt client with a Domotz Collector and shows a
cached, read-only Collector and Important Devices availability summary. Other
visible devices are reported separately as discovery context. Detailed
monitoring, alerts, history and diagnosis remain in Domotz. The same server-side
integration performs the confirmed GUDE power actions described above.

Create a Public API key in the Domotz Portal, then configure these server-side
settings locally and in Azure Static Web Apps:

- `DOMOTZ_API_BASE_URL`: the API Key Endpoint shown by Domotz, including
  `/public-api/v1`
- `DOMOTZ_API_KEY`: the corresponding Domotz Public API key
- `DOMOTZ_CACHE_TTL_MS`: optional cache duration; defaults to 60 seconds and is
  capped at 5 minutes

Never place the API key in frontend code or a `VITE_` setting. Restart the full
development environment after changing `api/local.settings.json`.

## Build

   npm run build

Output is created in `dist`.

## Azure Static Web Apps settings

- App location: `/`
- API location: leave blank
- Output location: `dist`

## Planned next steps

1. Create a GitHub repository.
2. Deploy this project to Azure Static Web Apps.
3. Connect `app.mptech.io`.
4. Add Microsoft Entra authentication.
5. Replace sample JSON with an independent API and database.
6. Add SharePoint document integration.
7. Add the onsite Watchkeeper agent.
