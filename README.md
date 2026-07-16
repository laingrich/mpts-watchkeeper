# MPTS Watchkeeper MVP

Initial deployable frontend for Azure Static Web Apps.

## Included

- Saltmarsh House site view
- Overview, Devices, Documents and Issues sections
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
