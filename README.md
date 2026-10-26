# Mecha Fleet: Versus — prototipo 0.2

Prototipo browser 2D leggero: mappa 20×20, 2–3 giocatori, 2 Super Robot + 4 Real Robot + Support + Capital Ship per giocatore, turni di squadra, HP/EN/SP/munizioni/VT, attacchi melee/ranged, supporto e vittoria per distruzione della Capital Ship.

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
5. **Armi:** melee richiede adiacenza e non consuma risorse; fucile e laser richiedono distanza 2–5. Fucile consuma 2 munizioni, laser 25 EN. Le speciali sono individuali e richiedono VT ≥120 e 40 EN. Il difensore sceglie Counter, Defend o Evade.
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

## Combattimento SRW (versione 0.2)
- Ogni flotta ha **2 Super Robot** (15.000 HP, molta armatura, poca evasione), **4 Real Robot** (7.500 HP, poca armatura, molta evasione), **1 Support** e **1 Capital Ship** (28.000 HP, movimento 1).
- Le unità ricevono nomi casuali senza ripetizioni nella partita e armi speciali individuali. Le speciali si sbloccano con **Volontà (VT) almeno 120**; le armi normali non richiedono soglie VT.
- Ogni attacco apre una scelta per il proprietario del bersaglio: **Counter** (scegli un'arma valida, il contrattacco avviene dopo l'attacco se il difensore sopravvive), **Defend** (riduce del 25% il danno residuo dopo la sottrazione dell'armatura) oppure **Evade** (riduce del 25 punti percentuali la probabilità di colpo). Il server calcola hit/miss e risorse.
- Le skill consumano **SP** (inizialmente 100, +10 a fine turno): **Aim** (prossimo attacco nel proprio turno certo, salvo Flash avversario: 50%), **Flash** (prossimo attacco ricevuto manca, salvo Aim: 50%; scade al ritorno del turno), **Invincible** (prossimo colpo subito causa al massimo 10 danni), **Foresight** (Aim+Flash su un altro alleato, costo 45), **Trust** (cura il 25% degli HP massimi a un alleato diverso), **Gain** (cura il 25% dei propri HP massimi).
- Le skill difensive possono sovrapporsi: Flash viene risolto prima di Invincible; se il colpo manca, Invincible resta attivo. Le skill non consumano l'azione normale, ma solo SP. Il combattimento sospende gli altri comandi finché il difensore non risponde.
- Le riparazioni recuperano 2.500 HP; rifornimento e movimento mantengono le regole precedenti. I danni delle armi e l'armatura sono valori fissi, con un bonus limitato dalla Volontà.
- Il prototipo non gestisce un timeout per la risposta difensiva: se il difensore resta collegato ma non sceglie, la partita attende. Una disconnessione equivale alla resa.

## Limiti noti del prototipo
- La mappa usa segnaposto pixel/forme Canvas, senza asset esterni.
- Il prototipo usa una sola stanza per processo server e non ha codice stanza/password.
- Gli attacchi usano armatura fissa e probabilità di colpo; non ci sono ancora coperture o linee di vista.
- La volontà sblocca le armi speciali a VT 120.
- Il server è autorevole per le azioni di gioco, ma questa versione è una base da testare e rafforzare, non un servizio pubblico pronto per produzione.

## Manutenzione
Le istruzioni per modificare, verificare e aggiornare il progetto sono in [AGENTS.md](AGENTS.md).
