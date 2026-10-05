#!/usr/bin/env bash
set -Eeuo pipefail

readonly ROOT_DIR="/srv/tracecart"
readonly SOURCE_DIR="$ROOT_DIR/source"

cd "$SOURCE_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing to deploy a dirty working tree." >&2
  exit 1
fi

corepack pnpm install --frozen-lockfile
corepack pnpm run check

commit="$(git rev-parse --short=12 HEAD)"
release="$ROOT_DIR/releases/$(date +%Y%m%d%H%M%S)-$commit"

mkdir -p "$release"
git archive HEAD | tar -x -C "$release"
cp -a dist "$release/dist"
cp -a node_modules "$release/node_modules"

ln -sfn "$release" "$ROOT_DIR/current.next"
mv -Tf "$ROOT_DIR/current.next" "$ROOT_DIR/current"

sudo systemctl restart tracecart

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3100/api/health >/dev/null; then
    echo "TraceCart deployed: $release"
    exit 0
  fi
  sleep 1
done

echo "TraceCart did not become healthy after deployment." >&2
sudo journalctl -u tracecart -n 80 --no-pager >&2
exit 1
