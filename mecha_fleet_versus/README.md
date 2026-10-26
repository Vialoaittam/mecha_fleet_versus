# Mecha Fleet: Versus — prototipo 0.1

Prototipo browser 2D leggero: mappa 20×20, 2–3 giocatori, 6 mecha + Capital Ship per giocatore, turni di squadra, HP/EN/munizioni/VT, attacchi melee/ranged, supporto e vittoria per distruzione della Capital Ship.

## Requisiti
- Node.js 18 o superiore
- Browser moderno (Chrome, Edge, Firefox, Opera)
- Rete locale per test LAN; per Internet serve un server raggiungibile pubblicamente

## Avvio rapido su Linux/macOS
Apri un terminale nella cartella del progetto:

```sh
npm ci
npm start
```

Apri `http://localhost:8080` in due schede per provare una partita locale.
Inserisci un nome ed entra nella stanza da entrambe; il primo giocatore può avviare.
Per altri dispositivi usa l'indirizzo LAN stampato dal server.
Non occorrono build, database o chiavi API.
Per usare un'altra porta: `PORT=8081 npm start`.
Arresta il server con `Ctrl+C`.

## Avvio su Windows
1. Estrai la cartella `mecha_fleet_versus`.
2. Installa Node.js LTS da https://nodejs.org/ se non è già installato.
3. Apri il Prompt dei comandi nella cartella del progetto.
4. Esegui:
   ```bat
   npm ci
   npm start
   ```
5. Apri `http://localhost:8080` sul PC host. La console mostra anche l'indirizzo LAN, per esempio `http://192.168.1.25:8080`.
6. Gli altri giocatori sulla stessa rete aprono l'indirizzo LAN dell'host. Se Windows Firewall lo chiede, consenti Node.js sulle reti private.
7. Ogni giocatore inserisce il nome e preme **Entra nella stanza**. Il primo è host. Quando sono entrati almeno 2 giocatori, l'host preme **Avvia partita**.

## Test consigliati
Esegui prima i test automatici con `npm test`. Usano il runner incluso in Node.js,
server temporanei su porte libere e client WebSocket reali; non modificano la partita
eventualmente avviata con `npm start`. I test del client verificano gli eventi con
un DOM minimale, senza coprire la resa grafica nel browser.

1. **Due giocatori:** apri la pagina in due browser/dispositivi; verifica che entrambi compaiano nella lobby e che il pulsante Avvia sia attivo solo per l'host.
2. **Terzo giocatore:** prima dell'avvio, apri la pagina da un terzo browser; deve comparire nella lobby. Il quarto ingresso deve essere rifiutato.
3. **Turni:** il giocatore attivo muove/attacca; l'altro deve vedere gli aggiornamenti e non poter agire fino al proprio turno.
4. **Movimento:** un mecha può muoversi entro 4 caselle Manhattan (supporto 3); non può attraversare/occupare caselle già occupate. La Capital Ship si muove di 1 casella per turno (mecha 4, supporto 3).
5. **Armi:** melee richiede adiacenza e non consuma risorse; fucile e laser richiedono distanza 2–5. Fucile consuma 2 munizioni, laser 25 EN. Le armi della Capital Ship infliggono il 75% di danni in più (arrotondati).
6. **Supporto:** un'unità Support o Capital Ship può rifornire/riparare un alleato entro 2 caselle.
7. **Vittoria:** attacca la Capital Ship finché HP=0; la flotta del proprietario viene eliminata e la partita termina quando resta una sola nave.
8. **Disconnessione:** in lobby libera il posto e, se esce l'host, il primo rimasto diventa host. Durante la partita equivale alla resa: la flotta viene eliminata e il turno passa al prossimo giocatore vivo. Non è previsto il recupero della sessione; anche ricaricare la pagina causa la resa.
9. **Nuova partita:** dopo che tutti i giocatori hanno chiuso le rispettive schede, la stanza torna disponibile senza riavviare il server. Riapri le pagine per entrare di nuovo.
10. **Mappa:** verifica selezione e movimento ridimensionando la finestra, anche su uno schermo ampio; le caselle devono restare quadrate e i clic corrispondere alle unità.

## Controlli
- Clicca un'unità alleata per selezionarla.
- Premi un'azione nel pannello; poi clicca il bersaglio o la casella sulla mappa.
- Per annullare un'azione in attesa, riclicca l'unità selezionata. Le istruzioni e gli errori appaiono sotto la mappa.
- **Termina turno** passa al giocatore successivo e rigenera 8 EN alle unità vive del giocatore.

## Limiti noti del prototipo
- La mappa usa segnaposto pixel/forme Canvas, senza asset esterni.
- Il prototipo usa una sola stanza per processo server e non ha codice stanza/password.
- Gli attacchi non usano ancora armatura, coperture o linee di vista.
- La volontà è presente e contribuisce al danno, ma la soglia delle abilità speciali non è ancora implementata.
- Il server è autorevole per le azioni di gioco, ma questa versione è una base da testare e rafforzare, non un servizio pubblico pronto per produzione.

## Manutenzione
Le istruzioni per modificare, verificare e aggiornare il progetto sono in [AGENTS.md](AGENTS.md).
