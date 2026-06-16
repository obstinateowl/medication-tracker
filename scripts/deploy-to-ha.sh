#!/usr/bin/env bash
# Build, package, inject local credentials, and rsync to Home Assistant addons share.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/deploy.local.env"
PACKAGE_DIR="${ROOT}/dist-ha/medication_tracker"
ADDON_NAME="medication_tracker"
SKIP_BUILD=false
MOUNTED_BY_SCRIPT=false
MOUNT_POINT=""

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  echo ""
  echo "Options:"
  echo "  --skip-build   Package/deploy without running npm run build"
  echo "  -h, --help     Show this help"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  echo "Copy deploy.local.env.example to deploy.local.env and edit it." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

require_var() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing required variable in deploy.local.env: $1" >&2
    exit 1
  fi
}

require_var DEPLOY_SMB_URL
require_var DEPLOY_SMB_USER
require_var DEPLOY_SMB_PASSWORD
require_var DB_PASSWORD

parse_smb_url() {
  local url="$1"
  if [[ "$url" =~ ^smb://([^/]+)/([^/]+)/?$ ]]; then
    SMB_HOST="${BASH_REMATCH[1]}"
    SMB_SHARE="${BASH_REMATCH[2]}"
    return 0
  fi
  if [[ "$url" =~ ^smb://([^/]+)/([^/]+)/(.+)$ ]]; then
    SMB_HOST="${BASH_REMATCH[1]}"
    SMB_SHARE="${BASH_REMATCH[2]}"
    return 0
  fi
  echo "Invalid DEPLOY_SMB_URL: ${url}" >&2
  echo "Expected format: smb://192.168.68.78/addons/" >&2
  exit 1
}

find_gvfs_mount() {
  local host="$1" share="$2"
  local gvfs="/run/user/$(id -u)/gvfs"
  local candidate
  shopt -s nullglob
  for candidate in \
    "${gvfs}/smb-share:server=${host},share=${share}" \
    "${gvfs}/smb-share:server=${host},share=${share},user=${DEPLOY_SMB_USER}" \
    "${gvfs}/smb-share:server=${host},share=${share}"*; do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  shopt -u nullglob
  return 1
}

try_gio_mount() {
  if ! command -v gio >/dev/null 2>&1; then
    return 1
  fi
  local uri="smb://${DEPLOY_SMB_USER}@${SMB_HOST}/${SMB_SHARE}"
  echo "Mounting ${uri} via gio..."
  gio mount "$uri" 2>/dev/null || true
  sleep 2
}

try_cifs_mount() {
  if ! command -v mount.cifs >/dev/null 2>&1; then
    return 1
  fi
  MOUNT_POINT="$(mktemp -d "${TMPDIR:-/tmp}/ha-addons.XXXXXX")"
  echo "Mounting //${SMB_HOST}/${SMB_SHARE} (temporary CIFS mount)..."
  mount -t cifs "//${SMB_HOST}/${SMB_SHARE}" "$MOUNT_POINT" \
    -o "username=${DEPLOY_SMB_USER},password=${DEPLOY_SMB_PASSWORD},vers=3.0,uid=$(id -u),gid=$(id -g)" \
    || return 1
  MOUNTED_BY_SCRIPT=true
  echo "$MOUNT_POINT"
}

smbclient_sync() {
  local dest="//${SMB_HOST}/${SMB_SHARE}"
  if ! command -v smbclient >/dev/null 2>&1; then
    echo "smbclient not found. Install samba client or set DEPLOY_MOUNT." >&2
    return 1
  fi

  echo "Uploading via smbclient to ${dest}/${ADDON_NAME}/ ..."
  local cred
  cred="$(mktemp)"
  chmod 600 "$cred"
  printf 'username=%s\npassword=%s\n' "$DEPLOY_SMB_USER" "$DEPLOY_SMB_PASSWORD" >"$cred"

  smb_ensure_dir() {
    local remote_path="$1"
    local built=""
    local part
    IFS='/' read -ra parts <<< "$remote_path"
    for part in "${parts[@]}"; do
      [[ -z "$part" ]] && continue
      built="${built:+$built/}${part}"
      smbclient "$dest" -A "$cred" -c "mkdir \"${built}\"" >/dev/null 2>&1 || true
    done
  }

  smbclient "$dest" -A "$cred" -c "prompt OFF; mkdir \"${ADDON_NAME}\"" >/dev/null 2>&1 || true

  while IFS= read -r -d '' file; do
    rel="${file#${PACKAGE_DIR}/}"
    remote_dir="${ADDON_NAME}/$(dirname "$rel")"
    remote_name="$(basename "$rel")"
    smb_ensure_dir "$remote_dir"
    smbclient "$dest" -A "$cred" -c "cd \"${remote_dir}\"; put \"${file}\" \"${remote_name}\"" >/dev/null
    printf '.'
  done < <(find "$PACKAGE_DIR" -type f -print0)

  rm -f "$cred"
  echo ""
}

cleanup() {
  if [[ "$MOUNTED_BY_SCRIPT" == true && -n "$MOUNT_POINT" && -d "$MOUNT_POINT" ]]; then
    umount "$MOUNT_POINT" 2>/dev/null || true
    rmdir "$MOUNT_POINT" 2>/dev/null || true
  fi
}
trap cleanup EXIT

resolve_deploy_target() {
  if [[ -n "${DEPLOY_MOUNT:-}" && -d "$DEPLOY_MOUNT" ]]; then
    echo "$DEPLOY_MOUNT"
    return 0
  fi

  parse_smb_url "$DEPLOY_SMB_URL"

  local gvfs_path
  if gvfs_path="$(find_gvfs_mount "$SMB_HOST" "$SMB_SHARE")"; then
    echo "$gvfs_path"
    return 0
  fi

  if try_gio_mount && gvfs_path="$(find_gvfs_mount "$SMB_HOST" "$SMB_SHARE")"; then
    echo "$gvfs_path"
    return 0
  fi

  if MOUNT_POINT="$(try_cifs_mount)"; then
    echo "$MOUNT_POINT"
    return 0
  fi

  return 1
}

echo "=== Medication Tracker deploy ==="

if [[ "$SKIP_BUILD" != true ]]; then
  echo "Building client + server..."
  (cd "$ROOT" && npm run build)
fi

echo "Packaging Home Assistant app..."
bash "${ROOT}/scripts/package-for-ha.sh"

echo "Injecting credentials into packaged config.yaml..."
node "${ROOT}/scripts/patch-ha-config.mjs" "${PACKAGE_DIR}/config.yaml"

VERSION="$(grep -E '^version:' "${PACKAGE_DIR}/config.yaml" | sed 's/version:[[:space:]]*"\?\([^"]*\)"\?/\1/')"
echo "Package version: ${VERSION}"

DEPLOY_TARGET=""
if DEPLOY_TARGET="$(resolve_deploy_target)"; then
  DEST="${DEPLOY_TARGET%/}/${ADDON_NAME}/"
  mkdir -p "$DEST"
  echo "Syncing to ${DEST} ..."
  # GVFS/Samba mounts often reject rsync temp files and permission changes
  rsync -rl --delete \
    --inplace \
    --no-perms --no-owner --no-group --omit-dir-times \
    "${PACKAGE_DIR}/" "$DEST"
  echo "Deploy complete → ${DEST}"
else
  parse_smb_url "$DEPLOY_SMB_URL"
  smbclient_sync || {
    echo "Deploy failed. Try setting DEPLOY_MOUNT to your mounted addons folder." >&2
    exit 1
  }
  echo "Deploy complete → //${SMB_HOST}/${SMB_SHARE}/${ADDON_NAME}/"
fi

echo ""
echo "On Home Assistant:"
echo "  grep version /addons/medication_tracker/config.yaml"
echo "  # expect: version: \"${VERSION}\""
echo ""
echo "Then: Settings → Apps → Check for updates → Update"
echo ""
echo "Note: config.yaml defaults apply on first install. Existing installs keep"
echo "      /data/options.json until you change options in the app UI."
