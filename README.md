# CMPOSR FIELD-1

Generatives Techno-Instrument zum Spielen mit dem Finger. Ein Song baut sich selbst auf
(z. B. Intro → Groove → Build → Peak → Break/Bass-Solo/Halftime → Rebuild → Peak II → Outro) und geht nach 3–4 Minuten fließend
in den nächsten Song über. Über das Feld spielst du live darüber. Alle Klänge werden in Echtzeit
synthetisiert (Web Audio), es gibt keine Samples.

## Bedienung

| Element | Funktion |
| --- | --- |
| Feld links ↔ rechts | Ton (immer in der Tonart des Songs) bzw. Drum-Ebenen MIN…MAX |
| Feld unten ↕ oben | Klang der gewählten Stimme |
| DRUMS · BASS · SYNTH · NOISE | Stimme, die das Feld spielt |
| SOUND | Pro Stimme 3 Klangmodelle und 4 Regler (WEIGHT, GRIT, MOTION, SPACE) |
| Weltname im Display | Genre wechseln – mit 8-Takt-Übergang wie im DJ-Mix |
| EVOLVE | Wie stark sich der Groove von Loop zu Loop verändert |
| VOL | Abhörlautstärke (beeinflusst die Aufnahme nicht) |
| NEXT | Leitet den nächsten Song ein (8-Takt-Outro); nochmal tippen = sofort wechseln |
| AUTO | Steuert alle Stimmen gleichzeitig: links ↔ rechts Ton, unten ↕ oben Energie. Loslassen = Autopilot |
| VOX | Computerstimme zum Set-Start und bei Songwechseln, eigener Text oder Vorschläge, 3 Klangfarben |
| REC · SET | Nimmt jeden Song als eigene MP3 auf (geschnitten am Songwechsel), dazu das ganze Set als eine nahtlose MP3 und eine M3U-Playlist |

## Plattformen

**Web-App (PWA)** – der Ordner `app/` ist die komplette App, ohne Build-Schritt.

```bash
npm run serve          # lokal unter http://localhost:8080
```

Auf iPhone/iPad in Safari „Zum Home-Bildschirm“, auf Android in Chrome „App installieren“.
Die App läuft danach im Vollbild und auch offline. Veröffentlichung im Netz: `.github/workflows/pages.yml`
stellt `app/` auf GitHub Pages bereit (einmalig unter Settings → Pages → Source „GitHub Actions“ aktivieren).

**iOS und Android (native Apps über Capacitor)** – dieselbe App in einer nativen Hülle.

```bash
npm install
npx cap add ios        # einmalig, braucht einen Mac mit Xcode
npx cap add android    # einmalig, braucht Android Studio
npm run ios            # öffnet das Projekt in Xcode
npm run android        # öffnet das Projekt in Android Studio
```

## Aufbau

- `app/index.html`, `app/field.css`, `app/field.js` – die App
- `app/manifest.webmanifest`, `app/sw.js`, `app/icons/` – Installation und Offline-Betrieb
- `prototype/` – frühere Prototypen (CORE, ORBIT) und die Ein-Datei-Vorschau von FIELD-1
- `app/voice.js` – eigener Formant-Sprachsynthesizer (deutsche Ausspracheregeln, bewusst robotisch)
- `app/vendor/lame.min.js` – MP3-Encoder [lamejs](https://github.com/zhuker/lamejs) (LGPL, siehe `app/vendor/lamejs-LICENSE.txt`), basiert auf [LAME](https://lame.sourceforge.io)
- `tools/build_artifact.py` – baut `prototype/field.html` aus `app/`
- `js/` – erste Fassung der Klang-Engine (wird von der App nicht mehr genutzt)
