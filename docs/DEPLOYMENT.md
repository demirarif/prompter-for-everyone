# Run and deploy

The application is static. It needs no backend, database, account service, environment variables or API keys. Build with Node.js 24 LTS and deploy the contents of `dist/` to an HTTPS static host.

## Local development

```sh
git clone https://github.com/demirarif/prompter-for-everyone.git
cd prompter-for-everyone
npm ci
npm run dev
```

Open the printed localhost address, usually `http://localhost:5173`. Then:

```sh
npm test
npm run build
npm run preview
```

The preview command serves the built app locally; it is not a production hosting service. Do not open the HTML file using a `file://` URL.

## Phone testing and HTTPS

For iPhone or Android testing, use an HTTPS deployment or an HTTPS development tunnel to your local Vite server. A tunnel URL is externally reachable; only share it with the people you intend to give access to the development server.

`npm run dev -- --host` can expose a server to your local network, but it does not add HTTPS. A phone visiting an HTTP LAN IP does not qualify for the localhost camera exception. Do not disable browser security to work around this.

When prompted on the intended site, allow camera and microphone access to record. If permission was denied, use that site's normal browser permission controls to change it. Browser/device media support determines whether the recording is MP4 or WebM and whether native sharing is available.

## GitHub Pages

The Vite base path is relative, so a repository URL such as `https://YOUR-USERNAME.github.io/prompter-for-everyone/` can serve the app without rebuilding it for a fixed repository name.

This repository's included CI workflow runs checks only. It does **not** automatically publish a website. To opt into GitHub Pages on your fork:

1. Open your repository's **Settings → Pages** and choose **GitHub Actions** as the build source.
2. Add a separate workflow such as `.github/workflows/pages.yml` using the example below.
3. Run that workflow from the repository's **Actions** tab. GitHub will show the actual published URL in the deployment output and Pages settings.

```yaml
name: Deploy GitHub Pages

on:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

The workflow uses GitHub's built-in deployment identity; no personal access token needs to be placed in the app. Repository or organization policies may require enabling Pages or approving the environment first.

## Netlify

Import your GitHub repository, select Node.js 24 for the build environment, and configure:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |

Netlify installs dependencies for the build. For a manual deployment, run `npm ci && npm run build` yourself and deploy `dist/`. No application environment variables are needed.

## Vercel

Import your repository, select the Vite framework preset and Node.js 24, and use:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |

No server functions or application environment variables are required.

## Any other static host

Build the project and copy the contents of `dist/` to the web root or desired subdirectory. Serve `index.html` and its bundled assets over HTTPS. The app does not use server-side routes, so it does not require API routing or server rewrite rules for its own screens.

After publishing, check on your intended browser:

- A script can be created, edited and retained after a page reload.
- The studio opens, and speed, width and color controls work.
- Camera/microphone permissions and a short recording work.
- Preview, download and any supported mobile save/share flow work.

Use disposable test text. The app does not migrate scripts from a previous domain automatically, and changing a hostname creates a different browser storage context.
