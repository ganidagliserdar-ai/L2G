/* AP 13-37 — Finance v2: persistente Finanztransaktionen. */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } };
const section = (t) => console.log('\n' + t);

let store = {};
const els = {}, named = {};
function makeEl(id) {
  return {
    id, value: '', checked: false, disabled: false, className: '',
    style: { setProperty(){}, removeProperty(){}, getPropertyValue(){ return ''; }, display: '' },
    dataset: {}, _tc: '', _html: '', children: [],
    get textContent() { return this._tc; },
    set textContent(v) {
      this._tc = String(v);
      this._html = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    _listeners: {},
    addEventListener(e, f) { (this._listeners[e] || (this._listeners[e] = [])).push(f); },
    removeEventListener(){}, appendChild(c){ this.children.push(c); }, focus(){}, reset(){},
    closest(){ return makeEl('x'); },
    querySelectorAll(){ return []; }, querySelector(){ return null; },
    setAttribute(){}, getAttribute(){ return null; }, remove(){},
    insertAdjacentHTML(){}, scrollIntoView(){},
    getBoundingClientRect(){ return { top:0, left:0, width:0, height:0 }; },
  };
}
const getEl = (id) => (els[id] || (els[id] = makeEl(id)));
const doc = {
  getElementById: getEl,
  querySelector: () => makeEl('q'),
  querySelectorAll: () => [],
  createElement: () => makeEl('c'), addEventListener(){},
  body: makeEl('body'), documentElement: makeEl('html'), readyState: 'complete', hidden: false,
};
function noop(){}
const audioStub = () => new Proxy(function(){ return audioStub(); }, {
  get(t, p) { if (p === 'currentTime') return 0; if (typeof p === 'symbol') return undefined; return audioStub(); },
  apply() { return audioStub(); }, has() { return true; },
});
const forgiving = (b) => new Proxy(b, {
  get(t, p) { if (p in t) return t[p]; if (typeof p === 'symbol') return undefined; return noop; },
  has() { return true; },
});
function boot() {
  const sandbox = {
    console, document: forgiving(doc),
    window: forgiving({ addEventListener(){}, localStorage: null,
      matchMedia: () => ({ matches:false, addEventListener(){} }),
      AudioContext: function(){ return audioStub(); } }),
    navigator: { serviceWorker: { register: () => Promise.resolve(), addEventListener(){} }, onLine: true },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    location: { origin:'http://localhost', href:'http://localhost/', protocol:'http:', reload(){} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    requestAnimationFrame: (f) => setTimeout(f, 0),
    matchMedia: () => ({ matches:false, addEventListener(){} }),
    fetch: () => Promise.reject(new Error('offline')), Math, Date, JSON,
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const appSrc = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).sort((a, b) => b.length - a.length)[0];
  const names = ['state','saveState','STATE_VERSION','FINANCE_TX_TYPES','isFinanceTxType',
    'recordFinanceTransaction','findFinanceTransaction','removeFinanceTransaction',
    'handleFinanceActionSubmit','selectFinanceActionType','processDueRecurringCosts',
    'deleteQuickExpense','pushLogEntry','newEntryId','todayStr','addDays','TRANSACTION_TYPES',
    'findTransactionType','resolveTransactionEffects','applyEffects','LOG_MAX_ENTRIES',
    'saveAvoidedExpenseFromFinanceAction','handleIncomeSubmit','advanceRecurringDate'];
  const patched = appSrc.replace(/\}\)\(\);\s*$/,
    '  globalThis.__T = { ' + names.map(n => n + ': typeof ' + n + " !== 'undefined' ? " + n + ' : undefined').join(', ') + ' };\n})();');
  vm.runInContext(patched, sandbox, { filename: 'index.html' });
  return sandbox.__T;
}
let T = boot();

/* Fährt den echten Finanzaktions-Pfad. financeActionType ist eine Modulvariable,
   sie wird über selectFinanceActionType() gesetzt. */
function finanzaktion(typeId, amount, opts) {
  const o = opts || {};
  T.selectFinanceActionType(typeId);
  getEl('financeActionAmount').value = String(amount);
  getEl('financeActionCategory').value = o.category || '';
  getEl('financeActionNote').value = o.note || '';
  getEl('financeActionLabel').value = o.label || '';
  getEl('financeActionIntensity').value = String(o.intensity || 5);
  getEl('financeActionGoalField').style.display = o.goalId ? 'block' : 'none';
  getEl('financeActionGoal').value = o.goalId || '';
  let err = null;
  try { T.handleFinanceActionSubmit(); } catch (e) { err = e; }
  return { err, tx: T.state.financeTransactions[T.state.financeTransactions.length - 1] };
}
const txCount = () => T.state.financeTransactions.length;

section('§1 Neuer State');
// AP 13-38 hat auf 5 erhöht; entscheidend bleibt, dass die Finance-v2-Felder existieren.
ok('STATE_VERSION ist mindestens 4', T.STATE_VERSION >= 4, String(T.STATE_VERSION));
ok('financeTransactions existiert als leeres Array',
   Array.isArray(T.state.financeTransactions) && T.state.financeTransactions.length === 0);
ok('financeTrackingSince startet als null', T.state.financeTrackingSince === null);

section('§2 Zulässige Transaktionstypen');
ok('genau fünf Typen',
   JSON.stringify(T.FINANCE_TX_TYPES) ===
   JSON.stringify(['sparen','investieren','geplante_anschaffung','fehlausgabe','fixkosten']));
['budget','avoided_expense','einkommen','quatsch'].forEach(id =>
  ok(`„${id}" ist kein Transaktionstyp`, T.isFinanceTxType(id) === false));

section('§4 Schreibpfade — Finanzaktion');
store = {}; T = boot();
let r = finanzaktion('sparen', 500);
ok('Sparen erzeugt eine Transaktion', !r.err && txCount() === 1, r.err && r.err.message);
ok('… vom Typ sparen mit Betrag 500', r.tx && r.tx.type === 'sparen' && r.tx.amount === 500,
   JSON.stringify(r.tx));
ok('§2 Datensatz trägt alle Pflichtfelder', (() => {
  const t = r.tx;
  return ['id','date','createdAt','type','amount','category','note','source'].every(k => k in t);
})(), JSON.stringify(r.tx));
ok('createdAt ist ein ISO-Zeitstempel', /^\d{4}-\d{2}-\d{2}T/.test(r.tx.createdAt));
ok('date ist das heutige Datum', r.tx.date === T.todayStr());

r = finanzaktion('investieren', 200);
ok('Investieren erzeugt Typ investieren', r.tx.type === 'investieren' && r.tx.amount === 200);
r = finanzaktion('geplante_anschaffung', 45, { category: 'Technik', note: 'Kopfhörer' });
ok('Geplante Anschaffung erzeugt Typ geplante_anschaffung', r.tx.type === 'geplante_anschaffung');
ok('… mit Kategorie und Notiz', r.tx.category === 'Technik' && r.tx.note === 'Kopfhörer',
   JSON.stringify(r.tx));
r = finanzaktion('fehlausgabe', 30, { category: 'Essen' });
ok('Fehlausgabe erzeugt Typ fehlausgabe', r.tx.type === 'fehlausgabe' && r.tx.amount === 30);
ok('vier Transaktionen insgesamt', txCount() === 4);
ok('alle IDs sind eindeutig',
   new Set(T.state.financeTransactions.map(t => t.id)).size === 4);

section('§5 Verknüpfung mit dem Log');
ok('Log-Eintrag referenziert die Transaktions-ID', (() => {
  const log = T.state.log[0];
  return log.financeTransactionId === r.tx.id;
})(), JSON.stringify(T.state.log[0] && T.state.log[0].financeTransactionId));
ok('findFinanceTransaction findet den Datensatz',
   T.findFinanceTransaction(r.tx.id) !== null);
ok('Log bleibt unverändert auf 50 Einträge begrenzt', T.LOG_MAX_ENTRIES === 50);

section('§4 Schreibpfad — Fixkosten');
store = {}; T = boot();
const gestern = T.addDays(T.todayStr(), -1);
T.state.recurringCosts = [{ id:'rc1', name:'Miete', amount:800, category:'Wohnen',
  interval:'monatlich', nextDueDate: gestern }];
T.processDueRecurringCosts(T.todayStr());
ok('fällige Fixkosten erzeugen eine Transaktion', txCount() === 1, String(txCount()));
ok('… vom Typ fixkosten mit Betrag 800',
   T.state.financeTransactions[0].type === 'fixkosten' && T.state.financeTransactions[0].amount === 800);
ok('… mit recurringCostId und source', (() => {
  const t = T.state.financeTransactions[0];
  return t.recurringCostId === 'rc1' && t.source === 'recurring_cost';
})(), JSON.stringify(T.state.financeTransactions[0]));
ok('… mit dem Fälligkeitsdatum, nicht dem heutigen',
   T.state.financeTransactions[0].date === gestern);
ok('Log-Eintrag ist verknüpft',
   T.state.log[0].financeTransactionId === T.state.financeTransactions[0].id);
ok('nextDueDate wurde fortgeschrieben',
   T.state.recurringCosts[0].nextDueDate !== gestern);

section('§3 Fachliche Abgrenzung');
store = {}; T = boot();
r = finanzaktion('budget', 0);
ok('Budget eingehalten erzeugt KEINE Transaktion', !r.err && txCount() === 0,
   r.err ? r.err.message : String(txCount()));
ok('… wird aber weiterhin geloggt',
   T.state.log.some(e => e.activityId === 'budget'));

store = {}; T = boot();
r = finanzaktion('avoided_expense', 70, { label: 'Neue Jacke', intensity: 7 });
ok('Financial Resistance erzeugt KEINE Transaktion', txCount() === 0, String(txCount()));
ok('… landet weiterhin in avoidedExpenses',
   T.state.avoidedExpenses.length === 1 && T.state.avoidedExpenses[0].amount === 70);

store = {}; T = boot();
getEl('incomeAmount').value = '2500';
getEl('incomeSource').value = 'Gehalt';
getEl('incomeDate').value = T.todayStr();
let incErr = null;
try { T.handleIncomeSubmit(); } catch (e) { incErr = e; }
ok('Einkommen erzeugt KEINE Transaktion', txCount() === 0, String(txCount()));
ok('… landet weiterhin in income[]', T.state.income.length === 1, incErr && incErr.message);

section('§1 financeTrackingSince');
store = {}; T = boot();
ok('bleibt null ohne Transaktion', T.state.financeTrackingSince === null);
T.selectFinanceActionType('budget');
finanzaktion('budget', 0);
ok('Budget setzt es nicht', T.state.financeTrackingSince === null);
finanzaktion('sparen', 100);
const since = T.state.financeTrackingSince;
ok('wird beim ersten echten Schreibvorgang gesetzt', since === T.todayStr(), String(since));
finanzaktion('investieren', 50);
finanzaktion('fehlausgabe', 20);
ok('bleibt danach unverändert', T.state.financeTrackingSince === since);
ok('wird auch durch einen Reload nicht verschoben', (() => {
  T.saveState();
  const T2 = boot();
  return T2.state.financeTrackingSince === since;
})());

section('§10 Persistenz gegen den 50-Einträge-Log');
store = {}; T = boot();
finanzaktion('sparen', 500);
finanzaktion('investieren', 200);
const alteIds = T.state.financeTransactions.map(t => t.id);
for (let i = 0; i < 120; i++) {
  T.pushLogEntry({ id: T.newEntryId(), date: T.todayStr(), activityId: 'lesen',
    label: 'Lesen', minutes: 10, intensity: 100, muscles: [], cores: [], xpBreakdown: [] });
}
ok('Log ist auf 50 Einträge gekappt', T.state.log.length === 50);
ok('die alten Finanz-Logeinträge sind aus dem Log verdrängt',
   !T.state.log.some(e => e.activityId === 'sparen'));
ok('die financeTransactions sind vollständig erhalten',
   txCount() === 2 && alteIds.every(id => !!T.findFinanceTransaction(id)));
ok('… auch über Save → Reload', (() => {
  T.saveState();
  const T2 = boot();
  return T2.state.financeTransactions.length === 2
      && alteIds.every(id => T2.state.financeTransactions.some(t => t.id === id));
})());

section('§7 Löschen');
store = {}; T = boot();
finanzaktion('fehlausgabe', 30, { category: 'Essen' });
const zuLoeschen = T.state.log[0];
const txId = zuLoeschen.financeTransactionId;
ok('Ausgangslage: Log-Eintrag und Transaktion verknüpft', !!txId && txCount() === 1);
T.deleteQuickExpense(zuLoeschen);
ok('Log-Eintrag entfernt', !T.state.log.some(e => e.id === zuLoeschen.id));
ok('verknüpfte Transaktion ebenfalls entfernt', txCount() === 0 && !T.findFinanceTransaction(txId));
ok('keine verwaisten Transaktionen', (() => {
  finanzaktion('sparen', 100);
  finanzaktion('investieren', 200);
  const ids = T.state.log.filter(e => e.financeTransactionId).map(e => e.financeTransactionId);
  return T.state.financeTransactions.every(t => ids.includes(t.id));
})());
ok('removeFinanceTransaction meldet, ob etwas entfernt wurde', (() => {
  const id = T.state.financeTransactions[0].id;
  return T.removeFinanceTransaction(id) === true && T.removeFinanceTransaction(id) === false;
})());
ok('Altbestand ohne Verknüpfung wird sauber gelöscht', (() => {
  store = {}; T = boot();
  const alt = { id: T.newEntryId(), date: '2026-01-01', activityId: 'fehlausgabe',
    label: 'Impulskauf', minutes: 0, intensity: 100, muscles: [], cores: [],
    xpBreakdown: [], betrag: 25, category: 'Essen' };
  T.state.log.unshift(alt);
  let e = null;
  try { T.deleteQuickExpense(alt); } catch (x) { e = x; }
  return !e && !T.state.log.some(l => l.id === alt.id) && txCount() === 0;
})());

section('§10 Backward Compatibility');
store = {}; T = boot();
T.state.income = [{ id:'i1', amount:2000, source:'Gehalt', date:'2026-07-01' }];
T.state.avoidedExpenses = [{ id:'r1', amount:70, category:'Kleidung', date:'2026-07-02',
  label:'Jacke', intensity:6, createdAt:'2026-07-02T10:00:00.000Z' }];
T.state.log.unshift({ id:'alt_fin', date:'2026-07-03', activityId:'sparen', label:'Gespart',
  minutes:0, intensity:100, muscles:[], cores:['wohlstand'], xpBreakdown:[], betrag:300 });
T.saveState();
// Felder aus dem gespeicherten Stand entfernen — so sähe ein v73-Stand aus.
const key = Object.keys(store).find(k => /sl_status/.test(k));
const alt = JSON.parse(store[key]);
delete alt.financeTransactions;
delete alt.financeTrackingSince;
store[key] = JSON.stringify(alt);
T = boot();
ok('alter Spielstand ohne die neuen Felder lädt fehlerfrei',
   Array.isArray(T.state.financeTransactions) && T.state.financeTransactions.length === 0);
ok('financeTrackingSince ist null', T.state.financeTrackingSince === null);
ok('§6 alte Finanz-Logeinträge werden NICHT migriert',
   txCount() === 0 && T.state.log.some(e => e.id === 'alt_fin'));
ok('income unverändert', T.state.income.length === 1 && T.state.income[0].amount === 2000);
ok('avoidedExpenses unverändert',
   T.state.avoidedExpenses.length === 1 && T.state.avoidedExpenses[0].amount === 70);

section('§8 Regression bestehender Finanzwirkung');
store = {}; T = boot();
/* Finanz-Stress startet bei 0 und ist nach unten geclampt — für die Prüfung, dass die
   Stress-Wirkung noch greift, muss ein Ausgangswert über 0 gesetzt werden. */
T.state.wealth.financeStress = 40;
const vorher = { coins: T.state.wealth.coins, stress: T.state.wealth.financeStress };
const spar = T.resolveTransactionEffects(T.findTransactionType('sparen'), { amount: 500 });
ok('Sparen erzeugt weiterhin Münz- und Stress-Effekte',
   spar.some(e => e.target === 'wealth.coins') && spar.some(e => e.target === 'wealth.financeStress'),
   JSON.stringify(spar.map(e => e.target)));
finanzaktion('sparen', 500);
ok('Münzen haben sich verändert', T.state.wealth.coins !== vorher.coins);
ok('Finanz-Stress wurde gesenkt (40 → 35)',
   T.state.wealth.financeStress === vorher.stress - 5, String(T.state.wealth.financeStress));
/* AP 13-38 §17: Sparen hat seine boss_damage-Capability verloren — Versuchung v2 nimmt
   Schaden ausschließlich aus Financial Resistance. Die übrigen Wirkungen bleiben. */
ok('Sparen hat keine boss_damage-Capability mehr (AP 13-38)',
   !T.findTransactionType('sparen').capabilities.includes('boss_damage'));
ok('goal_contribution unverändert vorhanden',
   T.findTransactionType('sparen').capabilities.includes('goal_contribution'));
ok('Fehlausgabe heilt weiterhin den Boss',
   T.findTransactionType('fehlausgabe').capabilities.includes('boss_heal'));
ok('recurringCosts, goals und wealth unverändert im State',
   Array.isArray(T.state.recurringCosts) && Array.isArray(T.state.goals) && !!T.state.wealth);

section('Reine Funktion recordFinanceTransaction');
store = {}; T = boot();
ok('unbekannter Typ wird abgelehnt',
   T.recordFinanceTransaction({ type:'budget', amount:10 }) === null && txCount() === 0);
ok('ungültiger Betrag wird abgelehnt',
   T.recordFinanceTransaction({ type:'sparen', amount:'viel' }) === null && txCount() === 0);
ok('abgelehnte Aufrufe setzen financeTrackingSince nicht',
   T.state.financeTrackingSince === null);
ok('gültiger Aufruf liefert die neue ID', (() => {
  const id = T.recordFinanceTransaction({ type:'sparen', amount:10 });
  return typeof id === 'string' && T.findFinanceTransaction(id) !== null;
})());
ok('optionale Felder erscheinen nur, wenn gesetzt', (() => {
  const id = T.recordFinanceTransaction({ type:'sparen', amount:10 });
  const t = T.findFinanceTransaction(id);
  return !('goalId' in t) && !('recurringCostId' in t);
})());

console.log('\n' + '─'.repeat(52));
console.log((fail === 0 ? 'ALLE TESTS BESTANDEN' : 'FEHLGESCHLAGEN') + `  —  ${pass} ok, ${fail} fehlerhaft`);
process.exit(fail === 0 ? 0 : 1);
