# Okno Anaboliczne: plan implementacji

## 1. Zebrane wymagania

### Techniczne
| Obszar | Decyzja |
|---|---|
| Platforma | PWA (instalowana na ekranie głównym Androida), działa offline |
| Stack | Czysty HTML + CSS + JavaScript (moduły ES), bez frameworka i bez kroku budowania |
| Dane | Tylko lokalnie (`localStorage`), eksport/import pliku JSON jako kopia zapasowa |
| Hosting | GitHub Pages (HTTPS, wymagane przez PWA) |
| Offline | Service Worker, cache-first dla plików aplikacji |
| Testy | Czysta logika (okno, cele, czas) w osobnym module, testy `node --test` |

### Funkcjonalne
1. **Kroczące okno anaboliczne**: suma białka z ostatnich *X* h (domyślnie 3 h) i limit (domyślnie 50 g), oba ustawiane.
   - Podgląd: zjedzone w oknie, ile jeszcze można, kiedy i ile się zwolni.
2. **Suma dzienna** (dzień od północy) i **cel dzienny**:
   - ręczny (g), albo
   - automatyczny: waga × g/kg zależnie od celu (masa 1,8 / utrzymanie 1,6 / redukcja 2,2, wartości edytowalne).
3. **Dodawanie wpisu**: gramy, opcjonalna nazwa, czas: *teraz / −15 / −30 / −60 min* lub dokładna godzina.
4. **Przekroczenie limitu**: wpis jest zapisywany, pojawia się ostrzeżenie (o ile g ponad limit, kiedy zwolni się okno). Podgląd już w formularzu.
5. **Zapisane produkty**: nazwa + porcja w g białka, dodanie jednym tapnięciem, sortowanie po częstości użycia. Przy dodaniu jest opcja „zapisz jako produkt”.
6. **Edycja i usuwanie wpisów** (z „Cofnij” po usunięciu).
7. **Historia dni**: ostatnie 30 dni, suma, % celu, rozwijana lista wpisów, średnia z 7 dni.
8. **Motywy**: System, Jasny, Ciemny, **Dracula** (gotycki fiolet/róż), **Pergamin** (ciepły, książkowy, brąz i serif).

## 2. Architektura

```
index.html              struktura 3 ekranów + arkusz dodawania/edycji
css/styles.css          motywy (zmienne CSS) + layout mobile-first
js/logic.js             czyste funkcje: okno, harmonogram zwolnień, cel, czas, historia
js/store.js             stan + localStorage + migracja/eksport/import
js/app.js               UI: render, zdarzenia, service worker
sw.js                   cache offline
manifest.webmanifest    instalacja PWA
icons/                  ikony 192/512 (+ maskable), SVG
tests/logic.test.js     testy logiki
```

### Model danych (`localStorage["oknoAnaboliczne.v1"]`)
```json
{
  "version": 1,
  "entries":  [{ "id": "…", "ts": 1757660000000, "grams": 30, "name": "Skyr", "productId": "…" }],
  "products": [{ "id": "…", "name": "Skyr", "grams": 18, "uses": 12, "lastUsed": 1757660000000 }],
  "settings": {
    "theme": "system", "windowHours": 3, "windowLimit": 50,
    "goalMode": "auto", "manualGoal": 160, "weight": 80, "goalType": "maintain",
    "gPerKg": { "bulk": 1.8, "maintain": 1.6, "cut": 2.2 }
  }
}
```

### Kluczowe algorytmy
- **Okno w chwili `t`**: wpisy z `ts ∈ (t − H, t]`, `used = Σ grams`, `available = max(0, limit − used)`.
- **Harmonogram zwolnień**: wpisy z okna sortujemy rosnąco. Każdy wypada w chwili `ts + H`, więc liczymy `available` po każdym wypadnięciu i pokazujemy tylko te momenty, w których realnie rośnie („14:30 → 20 g”).
- **Ostrzeżenie o przekroczeniu** (działa też dla wpisów wstecz): dla nowego wpisu sprawdzamy okna kończące się w każdym wpisie z przedziału `[ts, ts + H)` i bierzemy największą nadwyżkę.
- **Godzina wpisana ręcznie** późniejsza niż „teraz” oznacza wczoraj (zapomniany wieczorny posiłek).

## 3. Etapy
1. Szkielet: `index.html`, motywy CSS, nawigacja 3 zakładek.
2. `logic.js` + testy.
3. `store.js`: stan, zapis, eksport/import.
4. Ekran „Dziś”: pierścień okna, cel dzienny, szybkie produkty, lista wpisów.
5. Arkusz dodawania/edycji: czas wstecz, podgląd przekroczenia, zapis produktu.
6. Historia, Ustawienia (motyw, okno, cel, produkty, dane).
7. PWA: manifest, ikony, service worker.
8. README: uruchomienie lokalne i wdrożenie na GitHub Pages.

## 4. Świadome ograniczenia
- Brak powiadomień (nie wybrane; w PWA i tak niepewne).
- Historia liczy % względem *bieżącego* celu, bez zapisywania historycznych celów.
- Dane żyją w przeglądarce telefonu: wyczyszczenie danych Chrome je usuwa, dlatego jest eksport JSON.
