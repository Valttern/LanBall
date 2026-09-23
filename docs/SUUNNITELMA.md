# LanBall – suunnitelma

Arcade-henkinen "jalkapallo"-partypeli (vaikutteet: Tape to Tape, Speedball 2, Windjammers).
Pelataan paikallisesti samalla koneella ja lähiverkon yli. Ei simulaatio, vaan hullunkurinen ja kilpailullinen.

Merkinnät: **[G]** Valtterin päätös · **[E]** Clauden ehdotus, ei vielä kuitattu · **[A]** auki

## Päätösloki

| # | Tila | Päätös | Päivä |
|---|---|---|---|
| 1 | [G] | MVP tehdään webillä ja TypeScriptillä. Muuta alustaa (esim. Godot) harkitaan vasta, jos idea osoittautuu hyväksi. | 23.9.2026 |
| 2 | [E] | Simulaatio on erillään muusta: `step(tila, syötteet) → uusi tila`, 60 Hz. Ei riippuvuutta ruutuun, syötelaitteisiin tai verkkoon. | 23.9.2026 |
| 3 | [E] | Jokainen pelaaja on simulaatiolle syötelähde (näppäimistö, ohjain, verkko, botti). Paikallinen peli on host ilman etäpelaajia. | 23.9.2026 |
| 4 | [E] | Verkossa host päättää: asiakkaat lähettävät syötteet, host lähettää pelin tilan 30–60 Hz, asiakkaat interpoloivat. | 23.9.2026 |
| 5 | [E] | LAN-rajaus: ei ennustavaa liikettä, rollbackia eikä deterministisyysvaatimusta MVP:ssä. | 23.9.2026 |
| 6 | [E] | Sisältö (hahmot, powerupit, kentät) määritellään datana, ei koodihaaroina. | 23.9.2026 |
| 7 | [E] | Tekniikka: monorepo, jossa `sim` (puhdas TS, ei riippuvuuksia), `server` (Node + WebSocket `ws`) ja `client` (Vite + PixiJS). Vitest simulaation testeihin. | 23.9.2026 |
| 8 | [E] | Renderöintiin PixiJS eikä Phaser: Phaserilla on oma fysiikka ja scene-malli, jotka menisivät päällekkäin oman simulaation kanssa. | 23.9.2026 |
| 9 | [E] | Fysiikka tehdään itse: pelaajat ja pallo ovat ympyröitä, seinät janoja. Ei fysiikkakirjastoa. Pieni, hallittava ja pyörii samana palvelimella. | 23.9.2026 |
| 10 | [G] | Ohjausmalli: joukkueessa on kiinteä määrä hahmoja (esim. 4). Joukkueen ainoa pelaaja ohjaa koko joukkuetta ja vaihtaa aktiivista hahmoa (automaattisesti palloa lähimpään + vaihtonappi). Jos joukkueessa on useampi pelaaja, jokainen on lukittu omaan hahmoonsa. Tekoäly ohjaa hahmot, joita kukaan ei ohjaa. | 23.9.2026 |
| 11 | [E] | S1:n tekoäly on sääntöpohjainen: hahmo pysyy muodostelmapaikallaan, jahtaa palloa jos on joukkueestaan lähimpänä ja syöttää tai laukoo yksinkertaisella säännöllä. Hiotaan myöhemmin. Riski: tyhmä tekoälykaveri turhauttaa. | 23.9.2026 |

## Arkkitehtuuri

```
 syötelähteet                  simulaatio (sim)             näkymä (client)
 ┌──────────────┐          ┌────────────────────┐        ┌──────────────┐
 │ näppäimistö  │─┐        │                    │        │              │
 │ peliohjain   │─┼─ input │ step(tila, syött.) │ tila → │ PixiJS-      │
 │ verkko (ws)  │─┤  ────→ │ 60 Hz, puhdas TS   │ ─────→ │ renderöinti  │
 │ botti        │─┘        │                    │        │              │
 └──────────────┘          └────────────────────┘        └──────────────┘

 Paikallinen peli: kaikki selaimessa.
 LAN-peli: sim pyörii hostin Node-palvelimessa, selaimet lähettävät syötteet ja piirtävät tilan.
```

## Siivut

| Siivu | Sisältö | Mitä sillä selvitetään |
|---|---|---|
| S1 | Kenttä, pallo, 2 pelaajaa samalla näppäimistöllä, 2 joukkuetta tekoälykavereineen: liike, hahmon vaihto, syöttö, laukaus, taklaus, maali | Onko peli hauska jo ilman mitään lisuketta? |
| S2 | Sama peli LANissa: host + yksi asiakas | Toimiiko verkkoarkkitehtuuri? |
| S3 | Useampi pelaaja per joukkue (lukittu omaan hahmoon), peliohjaimet, aula ennen peliä | Toimiiko se partypelinä? |
| S4 | Hahmot ja powerupit | Syntyykö hullunkurisuus? |
| S5 | Viimeistely: äänet, efektit, ruudun tärinä | Tuntuuko peli hyvältä pelata? |

## Auki [A]

- Joukkueen koko ja kentän mittasuhteet
- Git-käytäntö (haara vai main, GitHub)
- Grafiikkatyyli ja kuka grafiikan tekee
- Pelaajien enimmäismäärä
- Ohjaimet (näppäimistö, peliohjain, puhelin ohjaimena?)
