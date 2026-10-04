#!/usr/bin/env bash
# Runs Lighthouse CI against a running production server and checks the
# budgets in lighthouserc.<form-factor>.json.
#
#   scripts/perf/lighthouse.sh mobile|desktop [base-url]
#
# The pages: the landing page, the country list, one country, one of its
# topics, and sign-in. The country and topic are whichever the country list
# shows first, so nothing here names a country.
set -euo pipefail
cd "$(dirname "$0")/../.."

FORM_FACTOR="${1:?usage: lighthouse.sh mobile|desktop [base-url]}"
BASE="${2:-http://localhost:3000}"
CONFIG="lighthouserc.${FORM_FACTOR}.json"

country="$(curl -fsS "$BASE/countries" | grep -oE 'href="/countries/[a-z]{2}"' | head -1 | cut -d'"' -f2)"
[ -n "$country" ] || { echo "No country pages found at $BASE/countries: is the database seeded?" >&2; exit 1; }
topic="$(curl -fsS "$BASE$country" | grep -oE "href=\"$country/[a-z0-9-]+\"" | head -1 | cut -d'"' -f2)"

urls=("--url=$BASE/" "--url=$BASE/countries" "--url=$BASE$country" "--url=$BASE/sign-in")
[ -n "$topic" ] && urls+=("--url=$BASE$topic")

# Each form factor starts from a clean slate: assert reads every report in .lighthouseci.
rm -rf .lighthouseci
pnpm exec lhci collect --config="$CONFIG" "${urls[@]}" > /dev/null
status=0
pnpm exec lhci assert --config="$CONFIG" || status=$?
# Keep the reports (CI uploads them) whether or not the budgets passed.
mkdir -p "lighthouse-reports/$FORM_FACTOR"
cp .lighthouseci/*.html .lighthouseci/*.json "lighthouse-reports/$FORM_FACTOR/" 2>/dev/null || true
exit "$status"
