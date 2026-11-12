# Klingelton – Android-App

Macht aus einem Video einen Klingelton (MP3, max. 40 Sekunden). Alles läuft offline auf dem Handy.

- `app/src/main/assets/www/index.html` – die Oberfläche (Design unverändert übernommen)
- `app/src/main/assets/www/lame.min.js` – MP3-Encoder lamejs (LGPL, siehe `lamejs-LICENSE.txt`)
- `app/src/main/java/.../MainActivity.kt` – App-Hülle: Galerie-Auswahl, Speichern, Teilen
- `app/src/main/java/.../AudioTrimmer.kt` – schneidet die Tonspur ohne Neukodierung heraus

## Bauen

```bash
cd klingelton
./gradlew assembleRelease   # → app/build/outputs/apk/release/app-release.apk
```

Oder in Android Studio den Ordner `klingelton/` öffnen. Auf GitHub baut der Workflow
„Klingelton-App bauen“ die APK automatisch (Actions → Artifacts).

Die Release-APK ist mit dem Debug-Schlüssel signiert und lässt sich direkt installieren.
Für den Play Store braucht es einen eigenen Signaturschlüssel.
