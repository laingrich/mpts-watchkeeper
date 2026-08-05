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

Watchkeeper can show live GUDE power-port state and provide confirmed **On**,
**Off** and **Reset** actions. Watchkeeper administrators and engineers can also
edit a port name; the helper writes that name to the GUDE and reads it back
before reporting success. A `watchkeeper_operator` role is intended for a
homeowner or crew member: it can operate power for explicitly assigned clients,
but cannot rename ports or edit engineering information. The production web app
does not receive GUDE
credentials and cannot call private site addresses directly. A loopback-only
helper on the engineer's computer or onsite Watchkeeper PC performs the local
device requests.

For managed GUDE IPPDUs, the GUDE device is the single source of truth for port
names and switching state. Watchkeeper does not maintain or apply a separate
outlet-name map. Names are limited to 15 characters by the GUDE. A change made
on either the GUDE or through Watchkeeper is shown on the next status refresh.
Port state refreshes automatically every 15 seconds and immediately after each
switching command.

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

Local setup:

1. Run `npm install --prefix helper` once to install the helper's SNMP library.
2. Copy `helper/config.example.json` to `helper/local.config.json`.
3. In the local file, add the selected Watchkeeper client's Jetbuilt ID, each
   Watchkeeper device ID, GUDE address, verified model, web username/password,
   SNMP write community, port count and any ports that must be protected from
   remote operation.
4. Run `npm --prefix helper run generate-keys` to generate one Ed25519 key
   pair. Store the displayed `WATCHKEEPER_HELPER_SIGNING_PRIVATE_KEY` value in the
   Watchkeeper API setting `WATCHKEEPER_HELPER_SIGNING_PRIVATE_KEY`, and put the
   displayed `authorisationPublicKey` value in `authorisationPublicKey` in
   `helper/local.config.json`. Do not put the private key in the helper file.
5. Run `npm run dev:helper` from the repository root.
6. Start Watchkeeper normally and open a GUDE device's **Power control** panel.

For local full-stack development, add
`WATCHKEEPER_HELPER_SIGNING_PRIVATE_KEY` to `api/local.settings.json` under
`Values`. Also add `WATCHKEEPER_OPERATOR_CLIENT_ACCESS` as a JSON object mapping
each operator's lower-case Entra user ID or email address to the Jetbuilt client
IDs they may access, for example:

```json
{"homeowner@example.com":["replace-with-jetbuilt-client-id"]}
```

Assign that person the `watchkeeper_operator` Static Web Apps role. An operator
with no valid mapping sees no clients and cannot obtain a helper authorisation.
For the deployed application, add both settings as Azure Static Web Apps
application settings. Local and cloud signing values must use the same key only
when both environments are intended to authorise the same helper.

The GUDE helper binds only to `127.0.0.1:47832`, permits explicitly configured
Watchkeeper browser origins, maps device IDs to locally approved addresses,
applies a per-port action cooldown and writes successful and failed action
attempts to the local audit log. Every status read and power command requires a
short-lived, server-signed authorisation scoped to the user, client and device.
Port-name authorisations are issued only to `watchkeeper_admin` and
`watchkeeper_engineer`; `watchkeeper_operator` authorisations are limited by the
server-side client mapping. The helper changes only the model-specific SNMP
port-name field, then reads the live GUDE status to confirm the result; the
browser cannot grant itself this access.
It deliberately uses a different port from
the existing Watchkeeper local agent on `127.0.0.1:47831`, so VPN launching and
device-reachability checks continue to work alongside GUDE control.
`helper/local.config.json` and audit logs are ignored by Git. Never place GUDE
credentials in the device launcher, frontend source, Azure settings or a
`VITE_` variable.

Changing `helper/local.config.json` requires restarting the helper. Changing
the local API setting requires restarting the local API; changing the deployed
setting requires a new application configuration/deployment to take effect.
This implementation controls
devices only from a computer that is running the helper and can reach the site
directly or through its approved VPN/Teleport connection; it is not a cloud
relay for mobile operation.

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
