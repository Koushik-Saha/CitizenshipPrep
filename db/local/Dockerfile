# Local and CI database: plain Postgres (same major version as the Neon
# project) plus pgTAP and pg_prove for the tests in db/tests.
FROM postgres:18

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    postgresql-18-pgtap \
    libtap-parser-sourcehandler-pgtap-perl \
  && rm -rf /var/lib/apt/lists/*
