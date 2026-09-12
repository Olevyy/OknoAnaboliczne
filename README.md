# Okno Anaboliczne

Lekka aplikacja PWA do śledzenia białka z **kroczącym oknem anabolicznym**: pilnuje, żeby nie zjeść zbyt dużo naraz (domyślnie 50 g na 3 h), i pokazuje postęp względem celu dziennego.

- bez frameworka i bez budowania: czysty HTML/CSS/JS
- działa offline, dane tylko w telefonie (z eksportem/importem JSON)
- motywy: System, Jasny, Ciemny, Dracula, Pergamin

Szczegóły wymagań i architektury są w [PLAN.md](PLAN.md).

## Uruchomienie lokalne

```bash
node tools/serve.js 8080
```

Potem otwórz http://localhost:8080.

## Testy

```bash
npm test
```

## Wdrożenie na GitHub Pages

1. Utwórz na GitHubie puste repozytorium, np. `okno-anaboliczne`.
2. W katalogu projektu:
   ```bash
   git init
   git add .
   git commit -m "Okno Anaboliczne v1"
   git branch -M main
   git remote add origin https://github.com/<login>/okno-anaboliczne.git
   git push -u origin main
   ```
3. Na GitHubie: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`** i zapisz.
4. Po minucie aplikacja będzie pod adresem `https://<login>.github.io/okno-anaboliczne/`.

## Instalacja na Androidzie

1. Otwórz adres w **Chrome**.
2. Menu ⋮ → **Dodaj do ekranu głównego** / **Zainstaluj aplikację**.
3. Aplikacja uruchamia się jak natywna, bez paska przeglądarki, i działa offline.

Przytrzymanie ikony pokazuje skrót **Dodaj białko**.

## Aktualizacje

Po `git push` telefon pobiera nowe pliki w tle, a zmiany widać przy kolejnym uruchomieniu aplikacji.
Jeśli dodajesz nowe pliki, dopisz je do `ASSETS` w `sw.js` i podbij `CACHE`.

> Dane są w pamięci Chrome. Wyczyszczenie danych przeglądarki lub odinstalowanie aplikacji je usuwa, więc co jakiś czas zrób **Ustawienia → Eksportuj**.
