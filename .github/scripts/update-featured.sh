#!/usr/bin/env bash
# Rewrites the repo cards between the FEATURED markers in README.md with the
# four most recently pushed public repos (no forks, no archived, not this repo).
# Needs the GitHub CLI, logged in locally or with GH_TOKEN set in Actions.
set -euo pipefail

user=FelixAshong
readme="$(cd "$(dirname "$0")/../.." && pwd)/README.md"

repos=$(gh repo list "$user" --visibility public --source --no-archived --limit 200 \
  --json name,pushedAt \
  --jq "[.[] | select(.name != \"$user\")] | sort_by(.pushedAt) | reverse | .[:4][].name")

cards=""
for repo in $repos; do
  cards+="  <a href=\"https://github.com/$user/$repo\"><img src=\"https://github-readme-stats.vercel.app/api/pin/?username=$user&repo=$repo&theme=tokyonight&hide_border=true\" alt=\"$repo\" /></a>"$'\n'
done

CARDS="$cards" awk '
  /<!-- FEATURED:START/ { print; printf "%s", ENVIRON["CARDS"]; skip = 1; next }
  /<!-- FEATURED:END -->/ { skip = 0 }
  !skip
' "$readme" > "$readme.tmp"
mv "$readme.tmp" "$readme"
