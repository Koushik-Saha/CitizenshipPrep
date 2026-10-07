#!/usr/bin/env bash
# Runs Lighthouse CI against a running production server and checks the
# budgets in lighthouserc.<form-factor>.json.
#
#   scripts/perf/lighthouse.sh mobile|desktop [base-url]
#
# The pages: the landing page, the country list, one country's test page, one
# of its topics, and sign-in. The country is the first in the sitemap that has
# a topic page (a topic gets one with its first published question), or
# failing that the first country, so nothing here names a country. Each page
# is scored for performance and for SEO, which has to be 100.
set -euo pipefail
cd "$(dirname "$0")/../.."

FORM_FACTOR="${1:?usage: lighthouse.sh mobile|desktop [base-url]}"
BASE="${2:-http://localhost:3000}"
CONFIG="lighthouserc.${FORM_FACTOR}.json"

# The sitemap's paths, whatever origin the site was built for. English
# addresses only: "/canada/citizenship-test", not "/es/canada/...".
pages="$(curl -fsS "$BASE/sitemap.xml" | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g; s#^https?://[^/]+##')"
topic="$(grep -E '^/[a-z0-9-]{4,}/citizenship-test/[a-z0-9-]+$' <<< "$pages" | head -1 || true)"
if [ -n "$topic" ]; then
  country="${topic%/*}"
else
  country="$(grep -E '^/[a-z0-9-]{4,}/citizenship-test$' <<< "$pages" | head -1 || true)"
fi
[ -n "$country" ] || { echo "No country pages in $BASE/sitemap.xml: is the database seeded?" >&2; exit 1; }

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
