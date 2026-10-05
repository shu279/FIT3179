# AFL team consistency

Staying at the Top of AFL is a data visualisation of the 18 AFL clubs across the 2012–2025 seasons, built with HTML, Pure.css, JavaScript and Vega-Lite.

- [Visualisation](https://shu279.github.io/FIT3179/)

## Run locally

Open the repository root in VS Code and use **Live Server** on `index.html`, or run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Visit <http://127.0.0.1:8000/>. No build step is required.

## Files

```text
index.html    Published visualisation
css/          Page styles
js/           JavaScript and Vega/Vega-Lite chart JSON
data/         Chart data, TopoJSON and source manifests
images/       Page images
vendor/       Pure.css and Vega libraries
scripts/      Data preparation and validation
```

The folder layout follows Week 8 Studio, section 3.3.

## Publishing and checks

GitHub Pages serves **main → /(root)** using **Deploy from a branch**, following Week 4 Tutorial Part B. `index.html` opens the visualisation directly; `.nojekyll` keeps it as static files. Push to `main` and check the Pages deployment in **Actions**.

To regenerate the chart JSON and validate all 15 charts from the repository root:

```sh
node scripts/create-specs.cjs
node scripts/validate.cjs
```
