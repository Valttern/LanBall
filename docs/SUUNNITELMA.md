# LanBall – suunnitelma

Arcade-henkinen "jalkapallo"-partypeli (vaikutteet: Tape to Tape, Speedball 2, Windjammers).
Pelataan paikallisesti samalla koneella ja lähiverkon yli. Ei simulaatio, vaan hullunkurinen ja kilpailullinen.

Merkinnät: **[G]** Valtterin päätös · **[E]** Clauden ehdotus, ei vielä kuitattu · **[A]** auki

## Päätösloki

| # | Tila | Päätös | Päivä |
|---|---|---|---|
| 1 | [G] | MVP tehdään webillä ja TypeScriptillä. Muuta alustaa (esim. Godot) harkitaan vasta, jos idea osoittautuu hyväksi. | 23.9.2026 |
| 2 | [G] | Simulaatio on erillään muusta: `step(tila, syötteet) → uusi tila`, 60 Hz. Ei riippuvuutta ruutuun, syötelaitteisiin tai verkkoon. | 23.9.2026 |
| 3 | [G] | Jokainen pelaaja on simulaatiolle syötelähde (näppäimistö, ohjain, verkko, botti). Paikallinen peli on host ilman etäpelaajia. | 23.9.2026 |
| 4 | [G] | Verkossa host päättää: asiakkaat lähettävät syötteet, host lähettää pelin tilan 30–60 Hz, asiakkaat interpoloivat. | 23.9.2026 |
| 5 | [G] | LAN-rajaus: ei ennustavaa liikettä, rollbackia eikä deterministisyysvaatimusta MVP:ssä. | 23.9.2026 |
| 6 | [G] | Sisältö (hahmot, powerupit, kentät) määritellään datana, ei koodihaaroina. | 23.9.2026 |
| 7 | [G] | Tekniikka: monorepo, jossa `sim` (puhdas TS, ei riippuvuuksia), `server` (Node + WebSocket `ws`) ja `client` (Vite + PixiJS). Vitest simulaation testeihin. | 23.9.2026 |
| 8 | [G] | Renderöintiin PixiJS eikä Phaser: Phaserilla on oma fysiikka ja scene-malli, jotka menisivät päällekkäin oman simulaation kanssa. | 23.9.2026 |
| 9 | [G] | Fysiikka tehdään itse: pelaajat ja pallo ovat ympyröitä, seinät janoja. Ei fysiikkakirjastoa. Pieni, hallittava ja pyörii samana palvelimella. | 23.9.2026 |
| 10 | [G] | Ohjausmalli: joukkueessa on kiinteä määrä hahmoja (esim. 4). Joukkueen ainoa pelaaja ohjaa koko joukkuetta ja vaihtaa aktiivista hahmoa (automaattisesti palloa lähimpään + vaihtonappi). Jos joukkueessa on useampi pelaaja, jokainen on lukittu omaan hahmoonsa. Tekoäly ohjaa hahmot, joita kukaan ei ohjaa. | 23.9.2026 |
| 11 | [G] | S1:n tekoäly on sääntöpohjainen: hahmo pysyy muodostelmapaikallaan, jahtaa palloa jos on joukkueestaan lähimpänä ja syöttää tai laukoo yksinkertaisella säännöllä. Hiotaan myöhemmin. Riski: tyhmä tekoälykaveri turhauttaa. | 23.9.2026 |
| 12 | [G] | Git: `main` paikallisesti, commit valmiin päätöksen tai siivun osan jälkeen, GitHub vasta pyynnöstä. Kirjattu CLAUDE.md:hen. | 23.9.2026 |
| 13 | [G] | Joukkue: 3 kenttäpelaajaa + tekoälymaalivahti, jota ei voi ohjata. Hahmon vaihto koskee vain kenttäpelaajia. Enintään 3 pelaajaa per joukkue, 6 koko pelissä. | 23.9.2026 |
| 14 | [G] | Areena ja säännöt: suljettu areena, joka mahtuu yhdelle ruudulle (ei kameraa). Seinät, joista pallo kimpoaa, pyöristetyt kulmat. Ei rajaheittoja, paitsioita, vapaapotkuja eikä kortteja. Taklaus aina sallittu ja kaataa hahmon hetkeksi. Maalin jälkeen aloitus keskeltä. Ottelu 2–3 min. Esteet ja pomppulevyt harkitaan S4:ssä. | 23.9.2026 |
| 15 | [G] | Ohjaimet MVP:ssä: näppäimistö (2 pelaajaa, WASD ja nuolet) ja peliohjaimet (selaimen Gamepad API, viimeistään S3). Liike + 3 nappia: syöttö, laukaus, taklaus. Hahmon vaihto automaattisesti ja syöttönapista, kun omalla hahmolla ei ole palloa. Puhelin ohjaimena (QR-koodi) myöhemmin, uutena syötelähteenä. | 23.9.2026 |
| 16 | [G] | S1-näyte hyväksytty: mittasuhteet (areena n. 1400 × 760, hahmo Ø 52, maali 180) ja tuntuma oikeaan suuntaan. | 23.9.2026 |
| 17 | [G] | Grafiikan suunta: Windjammersin, Speedball 2:n ja Tape to Tapen väliltä, näyttävä AAA-taso. Kuka tai mikä grafiikan tuottaa, on vielä auki. | 23.9.2026 |
| 18 | [G] | Pallon hallinta: pallo tarttuu hahmoon, mutta ei ole liimattu. Pallo kulkee aina hahmon edessä, jousi vetää sen paikalleen. Irtoaa: jyrkkä käännös täydessä vauhdissa, vastustajan kosketus, kova seinäosuma, taklaus. Menettäjällä 0,4 s nappausviive. Kuljettaja 90 % nopeudella. Luvut säätöarvoja, testataan pelaamalla. | 23.9.2026 |
| 19 | [E] | Pallon kanssa hahmo liikkuu katseensa suuntaan ja kääntyy hitaammin (7 vs 10 rad/s). Mitä jyrkempi käännös, sitä enemmän se hidastaa: 180° käännös tehdään lähes paikallaan. Syy: muuten pallo jää jälkeen ja irtoaa rauhallisessakin käännöksessä. | 23.9.2026 |
| 20 | [G] | Valtteri 23.9.: "hoida loppuun kyselemättä, AAA-laatu". Toteutan S1–S5 ilman välikysymyksiä ja kirjaan omat valinnat [E]-merkinnällä. Julkaisu, GitHub ja CLAUDE.md-muutokset kysytään silti. | 23.9.2026 |
| 21 | [E] | Syöttö: tähtäysapu. Pallo menee joukkuekaverille, joka on lähimpänä katseen suuntaa (±55°), voima etäisyyden mukaan. Aiottu vastaanottaja saa syötön aina haltuun, ja ohjaus siirtyy hänelle jo pallon ollessa matkalla. | 23.9.2026 |
| 22 | [E] | Laukaus: nappia pidetään pohjassa latauksen ajan (0,75 s), irrotus laukaisee. Jos katse osoittaa maalia kohti (±28°), tähtäys korjataan maalin sisään. Vapaaseen palloon voi laukaista suoraan (volley). Kova laukaus kimpoaa kenttäpelaajasta, maalivahti voi napata. | 23.9.2026 |
| 23 | [E] | Taklausnappi: ilman palloa liukutaklaus, joka kaataa vastustajan. Pallon kanssa lyhyt spurtti. | 23.9.2026 |
| 24 | [E] | Päätöksen 18 tarkennus: pallo irtoaa, kun vastustaja koskee itse palloon tai törmää kuljettajaan kovaa (yli 200 u/s). Pelkkä hipaisu ei riitä. Syy: muuten pallo vaihtoi omistajaa yli 300 kertaa ottelussa ja peli oli flipperiä. Maalivahdin käsissä olevaa palloa ei voi tönäistä irti. | 23.9.2026 |
| 25 | [E] | Ottelun kulku: 3 s alkulaskenta, 2:30 peliaikaa, maalin jälkeen 2,6 s juhlinta ja aloitus keskeltä päästäneelle joukkueelle. Tasatilanteessa kultainen maali. | 23.9.2026 |
| 26 | [E] | Hahmot (6 kpl): BRICK (tankki), ZIP (nopea), BOOMER (kova laukaus), NOODLE (kaartuvat laukaukset), SPROCKET (pitkä taklaus), DUCKY (powerupit kestävät pidempään). Maalivahti on oma hahmonsa. | 23.9.2026 |
| 27 | [E] | Powerupit (6 kpl): TURBO, GIANT (iso ja jyrää), MAGNET (vetää palloa), FIREBALL (seuraava laukaus lävistää ja kaataa pelaajat), FREEZE (vastustajat jäätyvät 2 s), BANANAS (3 banaanin kuorta, vastustaja liukastuu). | 23.9.2026 |
| 28 | [E] | Pelin tekstit englanniksi (GOAL!, KICK OFF). Arcade-konventio, ja peliä voi näyttää kenelle tahansa. Tekstit on helppo vaihtaa. | 23.9.2026 |

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

- Grafiikan tuotanto: kuka tai mikä tekee hahmot ja areenat (AAA-tavoite, päätös 17)
