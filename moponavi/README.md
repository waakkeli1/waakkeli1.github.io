# MopoNavi 🛵

Navigaattori mopoille ja skoottereille. Reitittää nopeimman reitin käyttäen **sekä** tavallisia ajoteitä (ei moottoriteitä eikä moottoriliikenneteitä, vain rajoitus ≤ 60 km/h) **että** kävely-/pyöräteitä, joissa on *"Sallittu mopoille"* -lisäkilpi. Aika-arvio olettaa mopon huippunopeudeksi 45 km/h, joten 60 km/h tie ei saa perusteetonta etua.

Toimii koko Suomessa: karttadata haetaan lennossa reitin ympäriltä OpenStreetMapista (Overpass API), eikä alueita tarvitse rajata etukäteen. Reititys lasketaan kokonaan selaimessa — ei palvelinta, ei API-avaimia.

## Julkaisu GitHub Pagesiin

1. Luo uusi repositorio GitHubissa (esim. `moponavi`).
2. Lataa tämän kansion tiedostot repositorion juureen:
   `index.html`, `app.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
   (`test.js` on valinnainen — se on vain kehitystesti, aja `node test.js`.)
3. Repositorion asetuksissa: **Settings → Pages → Source: Deploy from a branch → main / (root)** → Save.
4. Sivu aukeaa hetken päästä osoitteessa `https://<käyttäjä>.github.io/moponavi/`.

## Käyttö iPhonella

- Avaa sivu Safarissa ja hyväksy sijaintilupa (GPS vaatii HTTPS:n — GitHub Pages hoitaa sen).
- **Jako-nappi → Lisää Koti-valikkoon** → äppi aukeaa koko näytöllä ilman selainpalkkeja.
- Määränpään voi kirjoittaa hakukenttään tai valita kartalta pitkällä painalluksella.
- Navigointitilassa näyttö pysyy päällä (Wake Lock, iOS 16.4+) ja ääniohjeet saa päälle 🔊-napista.

## Miten reititys toimii

1. Lähtö- ja määränpää geokoodataan (Photon/Komoot).
2. Reitin ympäriltä haetaan Overpass API:lla:
   - ajotiet: `trunk…service` (moottoritiet eivät ole mukana kyselyssä)
   - mopoväylät: `cycleway/path/footway/pedestrian/track`, joilla `moped=yes`
3. Suodatus: `motorroad=yes`, `moped=no`, yksityistiet ja **maxspeed > 60 km/h** hylätään.
4. Nopeusmalli: tiet `min(maxspeed, 45)` km/h, mopoväylät n. 30 km/h, parkkipaikkojen läpiajo sakotetaan.
5. A\*-haku minimoi matka-ajan; yksisuuntaisuudet ja kiertoliittymät huomioidaan.
6. Kartalla ajotieosuudet ovat sinisiä, mopoväylät **kelta-mustia katkoviivoja** (kuten lisäkilpi).

## Tunnetut rajoitukset

- **Datan kattavuus:** "Sallittu mopoille" -tieto tulee OSM:n vapaaehtoiskartoituksesta (`moped=yes`). Kaikkia mopoväyliä ei ole merkitty, ja jokin merkintä voi olla vanhentunut. Puutteen voi korjata itse osoitteessa openstreetmap.org — korjaus näkyy äpissä n. vuorokaudessa.
- Yksi haku kattaa n. 35 km linnuntietä (selaimen muisti ja Overpassin kuormitus). Pidemmät matkat osissa.
- Käännöskiellot (turn restrictions) eivät ole vielä mukana.
- Overpass on julkinen ilmaispalvelu; ruuhka-aikaan haku voi kestää tai vaatia uuden yrityksen (äppi kokeilee kolmea peiliä).
- Sovellus on apuväline: liikennemerkit ja tieliikennelaki menevät aina sen edelle. Huom: laki ei varsinaisesti kiellä mopoa yli 60 km/h teillä (vain moottori- ja moottoriliikenneteillä), mutta tämä äppi välttää ne tarkoituksella turvallisuussyistä.

## Datalähteet

- Tiestö ja mopoväylät: © OpenStreetMapin tekijät (ODbL), Overpass API
- Geokoodaus: Photon (komoot.io)
- Karttalaatat: OpenStreetMap Standard
