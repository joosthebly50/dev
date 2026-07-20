# Commando's - 2026-07-21

Elk commando heeft: waar het werd uitgevoerd, wat het doet, en het
commando zelf. Wachtwoorden en andere geheimen staan hier nooit in.

## WiFi-hardware onderzoek (Bazzite-host)

Uitgevoerd op: Bazzite-host, lokale shell

Doel: Uitzoeken welke WiFi-hardware aanwezig is en of die als accesspoint kan dienen.

```
nmcli device status | grep -i wifi
iw dev
lspci | grep -iE "network|wireless|wifi"
lspci -k -s 07:00.0
rfkill list
lsmod | grep -i iwl
```

Doel: Uitzoeken welke VM de WiFi-kaart via VFIO-passthrough gebruikt.

```
virsh -c qemu:///system list --all --name
virsh -c qemu:///system dumpxml <vm> | grep -A8 "<hostdev"
cat /sys/bus/pci/devices/0000:07:00.0/driver_override
```

## KPN Box 14 admin-daemon (browser-automatisering)

Uitgevoerd op: Bazzite-host, `browser/` map van de repo

Doel: De bestaande Playwright/CDP-daemon voor het KPN-adminpaneel herstarten en de pagina heropenen.

```
curl -s http://localhost:9334/json/version
node launch-kpn-daemon.mjs   # (na pkill -f "profile-kpn" als hij al draaide)
```

Doel: DOM van het KPN-adminpaneel inspecteren om de renderer-methode (canvas vs. HTML) vast te stellen.

```
# Playwright-script (diag-kpn-dom2.mjs, verwijderd na gebruik) dat
# document.documentElement.outerHTML uitleest en canvas-elementen telt
```

Doel: Een CSS-kleurinversie testen als dark-mode-oplossing voor het KPN-paneel.

```css
html { filter: invert(1) hue-rotate(180deg) !important; background: #fff !important; }
img, video, svg, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }
```
(toegepast via `page.addStyleTag()` in een tijdelijk Playwright-script, daarna handmatig doorgegeven aan Joost voor Stylus/Dark Reader in zijn eigen Firefox)

## KDE/KWin kleurinversie-experiment (niet succesvol afgerond)

Uitgevoerd op: Bazzite-host, lokale shell (Plasma 6 / KWin 6.7.2)

Doel: Het ingebouwde "Invert"-effect van KWin laden en per venster activeren.

```
kwriteconfig6 --file kwinrc --group Plugins --key invertEnabled true
qdbus org.kde.KWin /KWin reconfigure
qdbus org.kde.KWin /Effects org.kde.kwin.Effects.loadEffect "invert"
qdbus org.kde.KWin /Effects org.kde.kwin.Effects.toggleEffect "invert"
qdbus org.kde.kglobalaccel /component/kwin org.kde.kglobalaccel.Component.shortcutNames
qdbus org.kde.kglobalaccel /component/kwin org.kde.kglobalaccel.Component.invokeShortcut "InvertWindow"
```

Resultaat: effect laadt en werkt (bevestigd via schermafbeelding), maar kon niet betrouwbaar aan het KPN-venster specifiek gekoppeld worden vanuit een script — steeds een focus-race met de terminal zelf. Configuratie (`invertEnabled`) na afloop weer teruggedraaid.

## Browserextensies (Chrome + Firefox, persoonlijk profiel van Joost)

Uitgevoerd op: Bazzite-host

Doel: Dark Reader en Stylus installeren in Joost's eigen, dagelijkse browserprofielen (niet de automatiseringsprofielen).

```
flatpak run com.google.Chrome "https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh"
flatpak run org.mozilla.firefox "https://addons.mozilla.org/firefox/addon/darkreader/"
flatpak run org.mozilla.firefox "https://addons.mozilla.org/firefox/addon/styl-us/"
```
