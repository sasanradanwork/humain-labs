# HumAIn Labs

A platform where people find and apply to research studies, and researchers set up profiles, build research groups and recruit participants.

## How it's built

The front end is a React 18 app built with Vite. The build produces one self-contained `index.html` in `web/dist`, so deployment is still a single static file with no server-side rendering.

| Part | Azure service | In this repo |
|---|---|---|
| Website | Azure Static Web Apps | `web/` — a React 18 app built with Vite |
| API | Managed Azure Functions (Node.js 20, v4 model) | `api/src` |
| Data | Azure Cosmos DB for NoSQL, serverless | created by `infra/main.bicep` |
| Sign-in | Static Web Apps built-in auth (Microsoft and GitHub) | `web/public/staticwebapp.config.json` |
| Verification emails | Azure Communication Services Email | created by `infra/main.bicep` |

Cosmos DB has one database, `humain`, with four containers:

- `researchers`, partitioned on `/id`: public profiles, each linked to a signed-in user.
- `groups`, partitioned on `/id`: group pages. Members are references to registered researchers.
- `studies`, partitioned on `/id`: open calls for participants.
- `applications`, partitioned on `/studyId`: participant applications. These are never sent to the browser except to the researcher who owns the study.

## Participants and researchers

The two groups use separate accounts and see different parts of the site.

- **Participants and signed-out visitors** see the homepage, open studies, Global reach and their own applications. The API only gives them studies and country counts (`/api/public`), with each study's researcher name, institution and verification status.
- **Researchers** are accounts with a researcher profile. They also see the researcher directory, research groups and the researcher area. That data comes from `/api/network`, which refuses anyone without a researcher profile.
- Researcher accounts can't apply to studies. Someone who is both uses two accounts.

## About page

`web/src/pages/public.jsx` has `FOUNDERS`, `PARTNERS` and `CONTACT_EMAIL` just above the `About` component, which fill the About page. Edit those to change who appears, where the partner enquiry email goes, and to add a founder's LinkedIn URL. Founder photos live in `web/src/data/` and are inlined at build time, so the built page is a single self-contained file. The partner entries are placeholders at the moment. The About page is in the menu for signed-out visitors; the link still works for anyone who has it.

## Sign in and register

The **Sign in** and **Register** buttons open one page. There you switch between *Participant* and *Researcher*, and between *Sign in* and *Register*. The side panel explains the three steps for whichever side you pick.

On Azure, both options use Microsoft or GitHub accounts, so there are no passwords to store. The choice only decides where people land afterwards: researchers who register go straight to profile setup.

## Publication stats

Researcher cards show a small radar chart of publication figures: publications, citations, h-index, i10-index, and output in the last three years. Each axis is scaled against the highest figure among researchers on the platform, so the shapes can be compared.

A group page's citation total is the sum of its members' OpenAlex figures, so nobody types it in. Members who haven't linked an ORCID simply don't contribute, and the page says how many of them are counted.

The numbers come from **OpenAlex** (`api/src/lib/handlers.js`, `fetchScholar`), which is free, open and needs no key. A researcher adds their ORCID iD, and the API looks them up at `api.openalex.org/authors/orcid:…` and stores the figures on their profile. Set `OPENALEX_MAILTO` to your contact email as an app setting to use OpenAlex's faster pool.

**Google Scholar has no public API and forbids automated access**, so a researcher's Scholar profile is stored and shown as a link only. Scraping it would risk your IP being blocked and would breach their terms. If you later want Scholar's own figures, the options are a paid third-party service such as SerpApi, or asking researchers to type the numbers in themselves.

## Group identifiers

Every research group gets a permanent public ID when it's created, in the spirit of an ORCID iD: `HLG-4K7P-2QA9-3F`. The last character is an ISO 7064 MOD 37,36 check character (`api/src/lib/ids.js`), so a mistyped ID is rejected rather than pointing at the wrong group. The ID is shown on the group page with a copy button, survives edits, and is searchable in the groups directory. It's also the group's web address: `#/groups/HLG-4K7P-2QA9-3F`, so the link is citable. Internal ids still resolve and are swapped for the canonical address on arrival, and IDs are matched whatever their case or punctuation.

Groups can also attach their institution's **ROR ID**, from the Research Organization Registry, the open registry of research institutions. The group editor searches ROR live (`/api/ror?q=…`, which proxies `api.ror.org/v2/organizations`) so the researcher picks their institution rather than typing an ID. The group page then links to the institution's ROR record.

## Researcher verification

Researchers verify by confirming an email address at their institution:

1. They enter the address.
2. The API emails a 6-digit code through Azure Communication Services.
3. They enter the code.

The rules around codes:

- Personal providers like Gmail and Outlook are refused.
- Codes expire after 15 minutes.
- Only a hash of each code is stored.
- A code can't be re-sent within a minute.
- Five wrong tries voids the code.

Verified profiles show a badge with the confirmed domain, such as "Verified @warwick.ac.uk".

**Only verified researchers can post studies, and participants only ever see studies from verified researchers.** If a researcher changes institution, they lose the badge. Their studies are then hidden from participants, who can't apply to them, until they verify again.

## Trending studies

The homepage ranks studies by recent interest (`api/src/lib/trending.js`). Each application adds to a study's score, and its weight halves every 10 days. Studies posted in the last 14 days get a small boost.

The page also shows an 8-week interest line and "Rising" and "New" labels. The line is scaled from 0 to 1, so exact applicant numbers are never shown.

Emails come from an Azure-managed sender address to start with (`DoNotReply@<random>.azurecomm.net`). To send from your own domain, add it to the Email Communication Service in the portal, verify its DNS records, and update the `EMAIL_SENDER` app setting.

## What the API enforces

- You have to be signed in to apply, create a profile, create a group or post a study.
- Researcher handles (@name) are unique. LinkedIn links must be `linkedin.com/in/…` profile URLs.
- Group members must be registered researchers.
- Only a group's creator, and members given "Can edit", can change a group page. Only the creator can delete it.
- Every study needs a closing date, which must be within a year. Closed studies disappear from the public list and stop taking applications.
- Only verified researchers can post studies. Only the researcher who posted a study can edit it, remove it or see its applicants.
- Each person can apply to a study once, and must agree to be contacted.
- Everyone only ever gets aggregate counts: applicants per country on Global reach, and, for researchers, applicants per study. Applicant details go to the researcher running that study and no one else.

## Deploy to Azure

You need the Azure CLI (`az login`) and a GitHub repository containing this folder.

1. **Create the resources.** This makes the Static Web App, the Cosmos DB account and the email service, and connects them:

   ```bash
   az group create -n humain-labs-rg -l uksouth
   az deployment group create -g humain-labs-rg -f infra/main.bicep
   ```

   Note the `staticWebAppName` and `siteUrl` outputs.

2. **Connect GitHub.** Get the deployment token and add it to your repo as the secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (GitHub → Settings → Secrets and variables → Actions):

   ```bash
   az staticwebapp secrets list -n <staticWebAppName> -g humain-labs-rg --query properties.apiKey -o tsv
   ```

3. **Push to `main`.** `.github/workflows/deploy.yml` runs the API tests, builds the React app, then deploys the site and API.

4. **Load the starting content** (optional). This loads the example researchers, groups and studies:

   ```bash
   cd api && npm install
   export COSMOS_ENDPOINT=$(az cosmosdb show -n <cosmosAccountName> -g humain-labs-rg --query documentEndpoint -o tsv)
   export COSMOS_KEY=$(az cosmosdb keys list -n <cosmosAccountName> -g humain-labs-rg --query primaryMasterKey -o tsv)
   npm run seed
   ```

   The example profiles aren't linked to anyone's sign-in, and their "Verified" badges are illustrative. Delete them in the Azure portal's Data Explorer before launch if you don't want them.

5. **Open `siteUrl`**, sign in, and set up your researcher profile from **Researcher area**.

## Run it locally

- **Quick preview, no Azure needed:** build the site once with `cd web && npm install && npm run build`, then run `cd ../api && npm install && npm run dev` and open http://localhost:4280. This serves the built site and runs the real API code against an in-memory copy of the example data, with a stand-in sign-in page. Verification codes are shown on screen instead of emailed. Data resets when you stop it.
- **Working on the front end:** `cd web && npm run dev` starts Vite on http://localhost:5173 with hot reloading, passing `/api` through to the dev server above (start that too). `npm run build` writes the finished site to `web/dist`.
- **Against a real Cosmos DB:** install the [Static Web Apps CLI](https://learn.microsoft.com/azure/static-web-apps/static-web-apps-cli-overview) and Azure Functions Core Tools. Copy `api/local.settings.example.json` to `api/local.settings.json`, fill in your Cosmos details, build the site, then run `swa start web/dist --api-location api`.
- **API tests:** `cd api && npm test`

### Where the front-end code lives

| Path | What it is |
| --- | --- |
| `web/src/App.jsx` | The shell: header, menu, hash routing, modals, toasts |
| `web/src/pages/public.jsx` | Home, studies, global reach, my applications, about, sign-in and register |
| `web/src/pages/researcher.jsx` | Researcher directory, group pages, researcher area, profile and group editors |
| `web/src/components/` | Cards and the search toolbar, modals, logo, radar and sparkline charts, badges |
| `web/src/lib/backends.js` | The three data sources: Azure API, Claude artifact database, browser storage |
| `web/src/lib/store.js` | The shared state React subscribes to |
| `web/src/lib/util.js` | Dates, countries, group IDs, trending scores |
| `web/src/styles.css` | All the styling |

Opening `web/dist/index.html` straight from disk also works. With no API to talk to, it runs on demo data saved in your browser.

## Sign-in options

Microsoft and GitHub sign-in work out of the box on every Static Web Apps plan. To add **Sign in with LinkedIn** (or Google), register it as a custom OpenID Connect provider in `staticwebapp.config.json`. That needs the **Standard** plan: deploy with `swaSku=Standard`. Note that custom registration switches off the built-in providers, so you'd register Microsoft there too.

## Before real participants use it

- Add a privacy notice and a data-retention policy for applications, since they hold personal data (name, email, age, country).
- Consider an admin role, assigned through Static Web Apps role invitations, for removing inappropriate content.
- Turn on Application Insights for the Static Web App to see API errors.
