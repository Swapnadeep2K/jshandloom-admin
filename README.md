# J.S. Handloom Admin

Frontend admin panel for managing J.S. Handloom products. A static single-page app deployed on GitHub Pages, backed by the J.S. Handloom Admin API hosted on Render.

All product changes go through GitHub pull requests — nothing is written directly to the live site.

## What it does

- **Add product** — upload saree photos, let AI extract product details, review and edit the draft, then submit as a GitHub PR
- **Add colour variants (batch)** — upload multiple photos at once for colour variants of the same design; shared fields (category, craft, price) are edited once, per-variant fields (name, colour, description) are edited individually
- **Manage products** — check/uncheck products to control what's live on the site; toggle the featured star to control what appears on the homepage; submit as a GitHub PR
- **Delete product** — remove a product from the catalogue via a GitHub PR
- **Manage categories** — view all categories, add new ones, and delete unused ones — each change goes through a GitHub PR

## How to use

The panel is PIN-protected. Enter the admin PIN to log in.

### Adding a single product

1. Upload one or more photos of the saree
2. Click **Analyse & generate** — the AI reads the photos and fills in name, colour, category, description, and fabric details
3. Review all fields; edit anything that needs correcting; reorder photos using the arrow buttons
4. Click **Add product** — a GitHub PR is raised; merge it to make the product live

### Adding colour variants (batch)

1. Upload photos for each colour variant (one slot per colour)
2. Click **Analyse & generate all** — the AI processes each variant independently
3. Edit the shared fields (category, craft, price) once in the shared block
4. Edit per-variant fields (name, colour, description, availability, fabric details) in each card
5. Click **Submit all** — a single GitHub PR is raised for all variants

### Managing live products and featured status

1. Go to the **Manage** tab
2. Check/uncheck products to control which are live on the site
3. Toggle the star icon to mark products as featured on the homepage
4. Click **Save changes** — a GitHub PR is raised; merge it to apply

### Managing categories

1. Go to the **Categories** tab
2. View all existing categories with their code and slug
3. Click **Add category** — enter a name; the API auto-generates a 3-letter code and a slug; a GitHub PR is raised
4. Click the delete icon on any category to remove it — blocked if any products still reference it

When adding a product in a category that doesn't exist yet, it is registered automatically in the same PR as the product — no need to pre-create it.

## Tech stack

- Vanilla HTML / CSS / JavaScript — no build step
- Deployed on GitHub Pages (via `.github/workflows/deploy.yml`)
- Communicates with the FastAPI backend via `fetch`

## Local development

No build step needed. Open `index.html` directly in a browser, or serve the folder with any static server:

```bash
python -m http.server 3000
# then open http://localhost:3000
```

The API URL in `app.js` automatically switches to `http://localhost:8000` when running on localhost, so start the backend API locally before testing.

## Deployment

Pushes to `main` automatically deploy via the GitHub Actions workflow in `.github/workflows/deploy.yml`. The workflow busts the cache on each deploy by appending the git SHA to `style.css` and `app.js` URLs.

The API URL is hardcoded in `app.js` — it points to `localhost:8000` when running locally and to the Render deployment otherwise. Update line 1 of `app.js` if the API URL changes.
