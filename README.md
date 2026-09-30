# Nickelpinch

Web-based envelope-budgeting app. This is the V2 rewrite (the legacy Laravel 4.2 app
lives on the `master` branch). Built on [InitiumPHP](https://github.com/timbotron/initium-php-core).

## Stack

- **Backend:** PHP on `timbotron/initium-php-core` (Composer) — FastRoute, League Plates,
  Medoo (PDO), Valitron, turnkey auth (signup / password reset / Mailgun) + admin area. MySQL.
- **Frontend:** [Mithril.js](https://mithril.js.org/) — no build step, single vendored file.
- **CSS:** Tailwind via the standalone CLI (dark-default theme). No JS bundler.

## Dev setup (Docker)

```bash
cp config/_env.php.template config/_env.php     # DB_SERVER=db, DB_NAME/USER/PASS=nickelpinch
docker compose run --rm composer                # one-time: install vendor/
docker compose up -d                            # app on http://localhost:8080
```

On first boot the `db` container imports core's migrations (`users`, `login_attempts`,
`settings`, reset-expiry) then the app migration `db/100-migration-nickelpinch.sql`, in
filename order. Migrations only run on a fresh volume — `docker compose down -v` to re-init.
Document root is `public/`; everything above it is not web-exposed.

## CSS build (Tailwind standalone CLI)

No npm. Grab the binary once (gitignored):

```bash
curl -fsSL -o bin/tailwindcss \
  https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-linux-x64
chmod +x bin/tailwindcss
```

Build the committed stylesheet:

```bash
./bin/tailwindcss -i tailwind/input.css -o public/css/app.css --minify   # one-off
./bin/tailwindcss -i tailwind/input.css -o public/css/app.css --watch    # dev
```

## License

MIT — http://opensource.org/licenses/MIT
