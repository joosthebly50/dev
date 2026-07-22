#!/usr/bin/env bash
# "Paniekknop" voor het OPNsense-als-hoofdrouter-migratieplan (zie
# Documents/decisions/architecture_decisions.md, "OPNsense-migratie-fallback").
#
# Dwingt af dat deze host (weer) rechtstreeks via de KPN-router internet
# haalt (enp6s0), ongeacht wat er verder aan routing-configuratie bij een
# latere fase (OPNsense als hoofdrouter) is toegevoegd. Verlaagt enp6s0's
# route-metric expliciet naar een vaste, lage waarde zodat hij altijd wint
# van een eventuele OPNsense-route, en herstart de verbinding zodat de
# wijziging direct actief wordt.
#
# Verandert NIETS aan enp5s0 of aan OPNsense zelf -- puur "zorg dat mijn
# eigen internet weer werkt", niets afhankelijk van of OPNsense uberhaupt
# nog bestaat/draait.
set -euo pipefail

KPN_CONNECTION="Wired connection 2"   # enp6s0, de directe KPN-verbinding
FALLBACK_METRIC=1                      # lager dan elke andere route, ook de OPNsense-route
VIRBR10_UUID="d7b72c0f-6250-4690-9d35-c3267860198d"  # de host's eigen IP op het lab-netwerk

echo "== Terugval naar directe KPN-verbinding =="
echo "Verbinding: $KPN_CONNECTION"

nmcli connection modify "$KPN_CONNECTION" ipv4.route-metric "$FALLBACK_METRIC"
nmcli connection up "$KPN_CONNECTION"

# Extra vangnet (2026-07-20, na Fase 4): als er ooit een OPNsense-default-
# route op virbr10 actief is (Fase 4 van de migratie), neutraliseer die
# route ook expliciet -- niet alleen vertrouwen op "onze metric is lager".
# KRITIEK: dit gebruikt 'nmcli connection modify' + 'device reapply', NOOIT
# 'connection up'/'down' op virbr10 -- dat laatste bleek tijdens Fase 4
# testen de libvirt-brugpoorten van alle labmachines los te koppelen (zie
# architecture_decisions.md, "Real network incident"). reapply raakt de
# brugpoorten niet aan, alleen de IP/route-configuratie.
echo
echo "OPNsense-route op virbr10 neutraliseren (indien aanwezig)..."
nmcli connection modify "$VIRBR10_UUID" ipv4.gateway "" ipv4.route-metric -1 2>&1 || true
nmcli device reapply virbr10 2>&1 || true

# DHCP-onderhandeling na 'connection up' toont de routetabel eerst nog even
# met een tijdelijke, veel hogere metric voor deze route (gezien tijdens
# testen: kortstondig 20050 i.p.v. de zojuist ingestelde 50) voordat die
# instelt -- even wachten zodat de paniekknop nooit een vals-verontrustende
# tussenstatus toont.
sleep 3

echo
echo "Klaar. Huidige routes:"
ip route show | grep -E "^default|enp6s0"

echo
echo "Test: curl naar 1.1.1.1 (Cloudflare, geen DNS nodig)..."
if curl -s -m 5 -o /dev/null -w "HTTP %{http_code}, %{time_total}s\n" http://1.1.1.1/; then
  echo "Internet werkt via de directe KPN-verbinding."
else
  echo "WAARSCHUWING: geen reactie van 1.1.1.1 -- controleer de kabel/KPN-router zelf." >&2
  exit 1
fi
