# Butterflix

Pure Node.js app - **no `npm install` needed** (zero dependencies).

## Run
```
cd butterflix        # the folder that contains server.js
npm start            # or: node server.js
```
Then open **http://127.0.0.1:8377/** (it redirects to /views/index.html).
Change the port with `PORT=3000 node server.js`.

## Default admin
admin@butterflix.com / admin123

## Structure
```
butterflix/
├── server.js          backend: static files + REST API (/api/...)
├── package.json       so `npm start` works
├── db.json            movie catalogue
├── data/              accounts.json, users.json (watchlists), sessions.json, spotlight.json
├── views/             index.html, login.html, industry.html, details.html
├── css/               style.css, layout.css
├── js/                main.js, auth.js, butterflies.js, utils.js, service/ (API wrappers)
├── exception/         small error classes
├── assets/images/     posters, backdrops (posters/real = JPGs, posters/gen = generated SVGs)
├── scripts/, tools/   poster download / generation helpers (dev only, not served)
```

## Troubleshooting
- **Stuck on the splash screen:** fixed in `js/main.js`. It used to hang forever if the browser held a saved login
  the server no longer knew (e.g. after switching between two copies of the project, which share `localhost:8377`),
  or if the API was unreachable. It now falls back to guest mode, or shows a red banner explaining the problem.
- **Red banner "Cannot reach the Butterflix server":** start the server (`npm start`) and open
  http://127.0.0.1:8377/ - don't open the .html files by double-click and don't use VS Code Live Server.
- **Port already in use:** stop the other copy, or run `PORT=3000 node server.js`.
