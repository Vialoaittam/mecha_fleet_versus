# Istruzioni per aggiornare Mecha Fleet: Versus

## Obiettivo e ambiente

Prototipo PvP tattico per browser: una mappa 20×20, 2–3 giocatori,
due Super Robot, quattro Real Robot, un Support e una Capital Ship per giocatore. Il server Node.js è autorevole;
il browser visualizza lo stato e invia comandi WebSocket.

Richiede Node.js 18 o superiore e npm. L'unica dipendenza applicativa è `ws`.
Non ci sono bundler, compilazione, database, servizi esterni o file `.env` richiesti.
Lo stato vive in memoria e viene perso quando il server termina.

## Prima di modificare

- Consulta l'inventario `~/.codex/inventario-dispositivi-vroby.md`, se disponibile,
  prima di interventi sulla rete locale. Aggiornalo solo per cambiamenti verificati
  dei dispositivi o servizi; non riportare qui indirizzi privati o credenziali.
- Leggi `README.md`, `package.json` e i file interessati. Esplicita le assunzioni;
  se un'ambiguità cambia l'obiettivo, chiedi prima di implementare.
- Per lavori in più passaggi, indica: `1. Passo → verifica: controllo → 2. Passo → verifica: controllo`.
- Correggi solo quanto richiesto, mantieni lo stile del file ed evita dipendenze,
  funzionalità, configurazioni e refactoring non necessari.
- Per un bug, aggiungi prima un test che lo riproduca e verifica che fallisca;
  applica la correzione e verifica che passi. Per un refactoring autorizzato,
  controlla i test prima e dopo.

## Mappa dei file e flusso

| File | Responsabilità |
| --- | --- |
| `server.js` | Server HTTP dei file in `public/`, lobby, identità dei socket, creazione flotte, turni, azioni, vittoria e disconnessioni. |
| `public/index.html` | Struttura dell'interfaccia; carica `movement.js` prima di `client.js`. |
| `public/client.js` | Connessione WebSocket, rendering Canvas, selezione e modalità delle azioni, pannelli e messaggi. |
| `public/movement.js` | Ricerca delle caselle raggiungibili senza attraversare unità vive, condivisa tra server e browser. |
| `public/style.css` | Layout responsive e dimensioni della mappa. |
| `tests/server.test.js` | Test HTTP e partite con server separati e client WebSocket reali. |
| `tests/client.test.js` | Test degli eventi del client con un DOM minimale; non simulano il rendering del browser. |
| `package.json`, `package-lock.json` | Comandi npm e dipendenze riproducibili. |

HTTP e WebSocket condividono la porta `PORT`, predefinita `8080`, su `0.0.0.0`.
`PORT=0` assegna una porta libera ed è usato dai test. Solo `public/` è servita via HTTP.

Il server invia `hello` e uno snapshot `state` alla connessione. Un messaggio
`{type:"join",name}` assegna l'identità tramite `joined`; il server associa il socket
al giocatore. I comandi usano `action` (`start`, `endTurn`, `move`, `attack`,
`resupply`, `repair`, `skill`, `react`) con `unitId` e, secondo il caso, `x`/`y`, `targetId` o `weapon`.
Le modalità `armMove`, `armLaser`, ecc. sono locali al client, non comandi del server.
Le azioni accettate pubblicano un nuovo snapshot a tutti i socket.

## Regole da preservare

- Il primo giocatore della lobby è l'host; solo lui avvia con almeno due giocatori.
  La stanza ammette al massimo tre giocatori e non accetta ingressi a partita iniziata.
- L'identità arriva dall'associazione al socket, mai da un proprietario dichiarato
  dal client. Il server convalida turno, proprietà, HP e disponibilità dell'azione.
- Ogni unità muove una volta e agisce una volta per turno. La Capital Ship può muoversi di 1 casella per turno ed ha danni delle armi aumentati del 75%.
  Il movimento usa passi ortogonali (4 per mecha, 3 per supporto), resta nella mappa
  e non attraversa né occupa altre unità vive. Modifica `movement.js` per mantenere
  identiche convalida del server e caselle evidenziate dal client.
- Armi valide: `melee`, `gun`, `laser` e `special` (individuale, VT >=120). Usa `public/rules.js` condiviso tra server e browser per statistiche, costi e gittate.
- Gli attacchi creano `state.pendingAttack`; solo il proprietario del difensore può rispondere con `react` (`defend`, `evade` o `counter` + arma). Il server risolve colpi, armatura, SP, VT e distruzione; durante l'attesa nessun'altra azione è ammessa.
- Skill: `aim`, `flash`, `invincible`, `foresight`, `trust`, `gain`. Le skill consumano SP e non l'azione; Flash scade all'inizio del prossimo turno del proprietario, Invincible si consuma solo se arriva danno.

- Supporto e nave riparano o riforniscono un'altra unità propria entro distanza 2,
  rispettando i massimi HP/EN/munizioni e consumando l'azione.
- Fine turno: azzera `moved`/`acted` e rigenera 8 EN e 10 SP alle unità vive del giocatore
  uscente, poi passa al prossimo proprietario con nave viva. Il giro aumenta il round.
- Nave distrutta: elimina tutta la flotta; l'ultima nave viva determina il vincitore.
  Nessuna azione di gioco è ammessa dopo la vittoria.
- Uscita dalla lobby: rimuove il giocatore e trasferisce il ruolo di host al primo
  rimasto. Disconnessione durante la partita: resa, eliminazione della flotta e
  passaggio del turno se necessario. Non esistono riconnessione o persistenza.
  Quando tutti i giocatori escono, la stanza torna alla lobby vuota.
- Il pannello di reazione deve essere disponibile al difensore anche fuori dal suo turno. Il Canvas deve restare quadrato. La conversione clic→casella usa le dimensioni
  effettive del contenuto, escludendo il bordo. Le istruzioni durante la partita
  vanno in `actionStatus`, quelle della lobby in `lobbyStatus`.
- I nomi e il registro visualizzati come HTML devono passare da `esc`.
  Input JSON o URL malformati non devono terminare il processo.

## Comandi di lavoro e verifica

Esegui dalla radice del progetto:

```sh
npm ci
npm test
node --check server.js
node --check public/movement.js
node --check public/client.js
npm start
```

`npm ci` reinstalla le dipendenze esatte del lockfile. `npm test` usa il runner
integrato di Node.js: i server temporanei scelgono porte libere e vengono chiusi
alla fine, senza interferire con una partita già avviata.

Controllo manuale: apri `http://localhost:8080` in due schede, entra con nomi diversi
e avvia dall'host. Prova movimento, attacco, passaggio del turno e selezione anche
nel turno avversario. Controlla le istruzioni sotto la mappa, annulla un'azione
ricliccando l'unità e ridimensiona la finestra per verificare caselle e clic.
Con tre schede verifica il limite della lobby e il salto di un giocatore eliminato.
Chiudi un giocatore durante il suo turno, poi tutti: la resa deve sbloccare il gioco
e una nuova coppia di giocatori deve poter avviare un'altra partita.
Arresta il server manuale con `Ctrl+C`.

## Come mantenere il progetto aggiornato

- Regole di gioco: modifica il server, adegua controlli e messaggi del client,
  aggiorna i test pertinenti e le regole descritte nel README.
- Interfaccia: conserva gli ID utilizzati dal client e il caricamento degli script;
  verifica il DOM dei test e la resa in un browser a diverse dimensioni.
- Dipendenze: aggiorna insieme manifest e lockfile, poi verifica con `npm ci` e
  `npm test`. Non modificare a mano `node_modules`.
- Cambiamenti a struttura, protocollo, configurazione o comandi richiedono
  l'aggiornamento di questo file e del README nella stessa modifica.
- Prima di consegnare, controlla il diff, esegui i test pertinenti e dichiara quali
  verifiche sono riuscite e quali non sono state possibili. Non dichiarare una
  verifica visiva se hai eseguito soltanto test del DOM.

Nota sul codice preesistente: `public/client - Copia.js.old` è una copia non caricata
dalla pagina; `currentPlayer()` nel server è inutilizzata. Non usarle come fonti
attive né rimuoverle come pulizia estranea alla richiesta.
