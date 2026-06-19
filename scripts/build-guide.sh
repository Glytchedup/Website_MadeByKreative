#!/usr/bin/env bash
# Build the phone-friendly, self-contained shop guide (with the interactive
# profit calculator) from RECOMMENDATIONS.md. Output: docs/kristol-guide.html
# Requires: pandoc.
#
#   bash scripts/build-guide.sh
set -e
cd "$(dirname "$0")/.."
pandoc docs/RECOMMENDATIONS.md -f gfm-tex_math_dollars -t html -s \
  -H scripts/guide-head.html \
  -A scripts/guide-calculator.html \
  --metadata title="MadeByKreative — Your Shop Guide" \
  -o docs/kristol-guide.html
echo "Wrote docs/kristol-guide.html ($(wc -c < docs/kristol-guide.html) bytes)"
