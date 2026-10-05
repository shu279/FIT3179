# FIT3179 — AFL team consistency

**Staying at the Top of AFL** is a static data visualisation of the 18 AFL clubs across the 2012–2025 seasons, built with HTML, Pure.css, JavaScript and separate Vega/Vega-Lite JSON files.

- [Prototype and setup instructions](prototype/README.md)
- [Page](prototype/index.html)
- [Data source manifest](prototype/data/manifest.json)
- [Live AFL visualisation](https://shu279.github.io/FIT3179/)

From the repository root, run `python3 -m http.server 8000` and open `http://localhost:8000/prototype/`. No build step is required.

The repository includes source attribution and an AI-assistance acknowledgement. The source research notes, project specification, lecture slides and assessment PDFs are kept locally.

## GitHub Pages

In this repository's **Settings → Pages**, use **Deploy from a branch**, select **main** and **/(root)**, then save. This follows the Week 4 tutorial's branch-based publishing method. The root `index.html` opens `prototype/`, where the page and its relative data, chart and asset paths stay together. `.nojekyll` serves the files without Jekyll processing.

Push changes to `main` to update the published page. Check the **pages build and deployment** run in **Actions**, then visit the live link above. The direct page is <https://shu279.github.io/FIT3179/prototype/>.

## History

The initial 15 commits were reconstructed on 28 September 2026 from saved work and Codex session records. The recorded work sessions took place on 14 and 28 September. For this retrospective history, the first eleven commits were assigned dates across 14–17 September, and the next four retain 28 September; exact times are approximate. These assigned dates organise the work into stages and are not a contemporaneous commit log. Subsequent development commits use their actual work dates.
