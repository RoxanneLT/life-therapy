# prisma/sql/seeds — starting data, run only by hand

Never run by `npm run db:apply`, and **never against production without reading the file first.**

`006_content.sql` overwrites content on every run. For example, it sets *every* course image to
the grey background, so running it against production would replace whatever the admin has
chosen since. It is here to build a fresh database (a test database, or a new project) with
the site's starting content.
