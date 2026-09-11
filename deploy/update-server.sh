#!/usr/bin/env bash
# Install root-owned as /srv/jianyoon/update-server.sh.
# Called only through a dedicated forced SSH command; accepts a tar.gz on stdin.
set -Eeuo pipefail
umask 077
base=/srv/jianyoon
mkdir -p "$base/releases" "$base/backups"
exec 9>"$base/update.lock"
flock -n 9 || { echo 'Another update is running'; exit 1; }
release=$(mktemp -d "$base/releases/release-XXXXXXXX")
archive="$release/payload.tar.gz"
cat > "$archive"
python3 - "$archive" "$release" <<'PY'
import sys, tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    members=archive.getmembers()
    if sum(m.size for m in members)>200*1024*1024:
        raise SystemExit('Archive too large')
    for member in members:
        p=PurePosixPath(member.name)
        if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0] not in ('dist','server','Dockerfile','.dockerignore'):
            raise SystemExit('Unexpected archive path')
        if not (member.isfile() or member.isdir()):
            raise SystemExit('Links and special files are not permitted')
    archive.extractall(sys.argv[2], members=members)
PY
test -f "$release/dist/index.html"
test -f "$release/server/server.mjs"
tag="jianyoon-library:$(basename "$release")"
# Build before stopping the running version.
docker build -t "$tag" "$release"
cd "$base"
test -f .env
test -f compose.yaml
previous=$(cat current-image 2>/dev/null || echo 'jianyoon-library:initial')
rollback() {
    echo 'Update failed; restoring previous application image.'
    LIBRARY_IMAGE="$previous" docker compose -p jianyoon-library up -d --no-build
}
trap rollback ERR
# Pause only this app while taking a consistent data snapshot.
LIBRARY_IMAGE="$previous" docker compose -p jianyoon-library stop library
docker run --rm --user 0 --entrypoint sh -v jianyoon-library-data:/data:ro -v "$base/backups:/backups" "$tag" -c "tar -czf /backups/$(basename "$release").tar.gz -C /data ."
LIBRARY_IMAGE="$tag" docker compose -p jianyoon-library up -d --no-build
healthy=0
for attempt in $(seq 1 20); do
    if curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null; then healthy=1; break; fi
    sleep 2
done
test "$healthy" = 1
printf '%s\n' "$tag" > current-image
trap - ERR
echo 'Update complete. Database and uploads kept in persistent volume.'
