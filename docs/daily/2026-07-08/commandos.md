# Commando's - 2026-07-08

⚠️ Reconstructie — geen volledig commando-transcript van deze dag
beschikbaar. Onderstaande is afgeleid uit het resultaat, niet uit een
directe log van uitgevoerde commando's.

## Firewall: subnet toevoegen aan hostgroup analyst

Uitgevoerd op: Security Onion (vermoedelijk)

```
sudo so-firewall includehost analyst 192.168.50.0/24
sudo so-firewall apply
```

Bewijs dat dit is gebeurd: `/opt/so/log/so-firewall.log`, regel
gedateerd 2026-07-08 (exact commando niet met zekerheid te reconstrueren,
alleen het resultaat).
