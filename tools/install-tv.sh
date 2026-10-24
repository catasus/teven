#!/bin/bash
# Bygger Teven-appen och installerar den på Samsung-TV:n.
# Användning: tools/install-tv.sh <TV-ens IP-adress> <certifikatprofil>
# Exempel:    tools/install-tv.sh 192.168.1.50 TevenProfil
set -e

TV_IP="$1"; PROFILE="$2"
if [ -z "$TV_IP" ] || [ -z "$PROFILE" ]; then
  echo "Användning: $0 <TV-IP> <certifikatprofil>"; exit 1
fi

TIZEN_HOME="${TIZEN_HOME:-$HOME/tizen-studio}"
export PATH="$TIZEN_HOME/tools:$TIZEN_HOME/tools/ide/bin:$PATH"
for t in sdb tizen; do
  command -v $t >/dev/null || { echo "Hittar inte '$t'. Är Tizen Studio installerat i $TIZEN_HOME?"; exit 1; }
done

cd "$(dirname "$0")/.."
rm -rf tizen/.buildResult Teven.wgt

echo "1/5 Bygger appen"
tizen build-web -- tizen

echo "2/5 Paketerar och signerar med profilen '$PROFILE'"
tizen package -t wgt -s "$PROFILE" -- tizen/.buildResult

echo "3/5 Ansluter till TV:n på $TV_IP"
sdb connect "$TV_IP"
sleep 2
TARGET=$(sdb devices | awk -v ip="$TV_IP" '$1 ~ ip {print $NF}' | head -1)
[ -n "$TARGET" ] || { echo "TV:n syns inte i 'sdb devices'. Kontrollera utvecklarläge och IP-adress."; sdb devices; exit 1; }
echo "   TV-namn: $TARGET"

echo "4/5 Installerar"
WGT=$(ls tizen/.buildResult/*.wgt | head -1)
tizen install -n "$(basename "$WGT")" -t "$TARGET" -- "$(dirname "$WGT")"

echo "5/5 Startar appen"
tizen run -p TevenDash0.Teven -t "$TARGET"
echo "Klart."
