# Polices

Les familles **Bricolage Grotesque**, **Hanken Grotesk** et **IBM Plex Mono**
sont chargées au runtime depuis les paquets `@expo-google-fonts/*`
(voir `hooks/useTheme.ts` → `useAppFonts`). Aucun fichier `.ttf` n'a donc besoin
d'être committé ici.

Pour embarquer des `.ttf` locaux à la place (ex. build hors-ligne), déposez-les
dans ce dossier et remplacez le mapping de `useFonts()` par des `require()`.
