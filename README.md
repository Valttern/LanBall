# LanBall

Arcade-henkinen "jalkapallo"-partypeli selaimeen. 3 kenttäpelaajaa + maalivahti per joukkue, 1–6 pelaajaa,
tyhjät paikat täyttää tekoäly. Pelataan samalla koneella (näppäimistö ja peliohjaimet) tai lähiverkossa
jokainen omalla selaimellaan.

## Pelaaminen

**Pelaa heti selaimessa:** https://valttern.github.io/LanBall/ (samalla koneella, näppäimistöt ja peliohjaimet).
LAN-peli vaatii hostin, katso alta.

**Samalla koneella** tai **LAN-juhlat**: yksi kone on host.

```bash
npm install
```

```bash
npm run host
```

Host tulostaa osoitteen (esim. `http://192.168.1.23:8080`). Kaverit avaavat sen omalla selaimellaan
samassa verkossa, valitsevat **LAN party** ja painavat syöttönappia liittyäkseen. Aulassa näkyy myös QR-koodi.
Samalla koneella pelatessa valitaan **Play on this computer**.

| | Näppäimistö, vasen | Näppäimistö, oikea | Peliohjain |
|---|---|---|---|
| Liike | WASD | nuolet | tatti / ristiohjain |
| Syöttö | F | , | A |
| Laukaus (pidä = lataa) | G | . | B tai RT |
| Taklaus / spurtti | H | - | X tai RB |

Aulassa: syöttönappi liittyy ja merkitsee valmiiksi, vasen/oikea vaihtaa joukkuetta, ylös/alas hahmoa.
Aulan asetuksista valitaan ottelun pituus, powerupit ja bottien taso (Easy / Normal / Hard).
Esc tai Start pysäyttää paikallisen ottelun. M mykistää äänet. C kääntää kameran: sivulta (maalit
vasemmalla ja oikealla) tai päädystä (maalit ylhäällä ja alhaalla). Valinta muistetaan selaimessa.

## Kehitys

```bash
npm run dev
```

Vite osoitteessa `http://localhost:5173`. LAN-tilaa varten käynnistä rinnalle palvelin
(Vite ohjaa `/ws`:n sille):

```bash
npm run server
```

```bash
npm test
```

```bash
npm run typecheck
```

Kehitystilassa selaimen konsolissa on `window.__lanball` (tila, `advance()`, `step()`, `focus()`),
jolla peliä voi ajaa ja kuvata myös piilotetussa välilehdessä.

## Rakenne

- `packages/sim` – koko pelilogiikka puhtaana TypeScriptinä: `step(tila, syötteet) → uusi tila`, 60 Hz.
  Fysiikka, pallon hallinta, tekoäly, powerupit, hahmot, aula ja verkkoprotokolla. Ei riippuvuuksia.
- `packages/server` – LAN-host: jakaa pelin selaimille ja ajaa ottelua (Node ajaa TypeScriptin suoraan).
- `packages/client` – selainpeli: PixiJS-piirto, efektit, syntetisoidut äänet, valikot, ohjaimet.

Suunnitelma ja päätösloki: [docs/SUUNNITELMA.md](docs/SUUNNITELMA.md).
