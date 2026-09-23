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
| 29 | [E] | Visuaalinen suunta "kattoareena auringonlaskussa": taivas koralli–magenta–luumu, kenttä luumuasfalttia keltaisin viivoin, kromilaidat ja joukkuevärein hehkuvat LED-nauhat. BLAZE (#FF5A36) vs FROST (#3CC8FF). Fontit Bungee (logo, tulostaulu, bannerit) ja Rubik (muu teksti). Hahmot chibi-tyylisiä: paita joukkueen väriä, pää ja hattu kertovat hahmon. Kaikki taide piirretään koodilla, äänet syntetisoidaan. | 23.9.2026 |
| 30 | [E] | LAN-host: `npm run host` rakentaa pelin ja jakaa sen porttiin 8080. Aulassa näkyy kotiverkon osoite ja QR-koodi. Jos selain lakkaa lähettämästä syötteitä yli 0,5 s, sen hahmo pysähtyy. | 23.9.2026 |
| 31 | [G] | GitHub: julkinen repo Valttern/LanBall, peli julkaistaan GitHub Pagesiin (https://valttern.github.io/LanBall/) jokaisen mainiin pushatun muutoksen jälkeen, kun testit menevät läpi. Pagesissa toimii peli samalla koneella; LAN vaatii hostin. Repo tunnistautuu Valttern-tilillä omalla git-asetuksellaan, koneen oletustili pysyy kalaherkut. | 23.9.2026 |
| 32 | [G] | Kamera ja kenttä Tape to Tape -tyyliin (kumoaa päätöksen 14 kohdan "yksi ruutu, ei kameraa"): kenttä noin 1,6× isompi kumpaankin suuntaan, kamera seuraa palloa zoomattuna ja vino kuvakulma (syvyyssuunta litistetty, laidoilla korkeus). Ruudun ulkopuolella olevat ihmispelaajat näkyvät reunanuolina. Näyte näytetään kuvana ennen viimeistelyä. | 23.9.2026 |
| 33 | [G] | Näyte hyväksytty. Lisäksi kameran suunnan voi vaihtaa: vaaka (maalit vasemmalla ja oikealla) tai pysty (maalit ylhäällä ja alhaalla). Ohjaus on aina ruudun suuntainen. Valinta tallentuu selaimeen, LAN:ssa jokainen valitsee omansa. | 23.9.2026 |
| 34 | [E] | Isompaan kenttään sovitetut nopeudet: pelaajat +10 %, laukaukset ja syötöt noin +10 %, pallo liukuu pidemmälle. | 23.9.2026 |
| 35 | [G] | Tekoäly on hieman liian hyvä → heikennetään maltillisesti. Säätöarvot kootaan `TUNING.ai`:hin: taklaukset harvemmin, lyhyemmältä ja vain suoraan edestä, jahtaaminen 88 % nopeudella, laukauksiin hajontaa, harkinta hitaampi, maalivahti hitaampi ja lyhyempi ulottuvuus. Bottiotteluissa (6 kpl) taklaukset 49 → 28,5 ja kaadot 42 → 22 per ottelu, maalit 4,2 → 5,8. Tuntuma pitää vielä varmistaa pelaamalla. | 23.9.2026 |

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

| Siivu | Sisältö | Tila 23.9.2026 |
|---|---|---|
| S1 | Kenttä, pallo, liike, syöttö, laukaus, taklaus, hahmon vaihto, tekoäly | Valmis. Testattu yksikkötesteillä ja selaimessa. |
| S2 | LAN: host + asiakkaat | Valmis. Testattu huonetesteillä ja kahdella selainvälilehdellä oikeaa palvelinta vasten. |
| S3 | Useampi pelaaja per joukkue, peliohjaimet, aula | Valmis. Peliohjain testattu simuloidulla Gamepad API:lla, ei fyysisellä ohjaimella. |
| S4 | Hahmot ja powerupit | Valmis: 6 hahmoa, 6 powerupia. |
| S5 | Viimeistely: grafiikka, efektit, äänet | Valmis ensimmäisenä versiona. Äänet tarkistettu vain virheettömyyden osalta, ei korvalla. |

## Auki [A]

- Tuntuma: säätöarvot (nopeudet, jousi, laukausvoimat, tekoälyn aggressiivisuus) vaativat oikeaa pelaamista ihmisillä.
- Grafiikan tuotanto: nyt kaikki piirretään koodilla. Käsin piirretyt hahmot vaatisivat piirtäjän tai kuvageneraattorin.
- Puhelin ohjaimena (päätös 15: myöhemmin).
