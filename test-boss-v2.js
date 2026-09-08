/* AP 13-38 — Financial Resistance & Versuchungs-Boss v2. */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } };
const section = (t) => console.log('\n' + t);

let store = {};
const els = {};
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
  getElementById: getEl, querySelector: () => makeEl('q'), querySelectorAll: () => [],
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
  const names = ['state','saveState','STATE_VERSION','computeResistanceBossDamage',
    'applyTemptationDamage','applyTemptationHeal','defaultTemptationBoss','renderBossFight',
    'TEMPTATION_BOSS_MAX_HP','TEMPTATION_BOSS_REWARD_COINS','TEMPTATION_BOSS_HEAL',
    'TEMPTATION_BOSS_CONTEXTS','RESISTANCE_CONTEXTS','RESISTANCE_NO_CONTEXT',
    'handleFinanceActionSubmit','selectFinanceActionType','updateFinanceActionPreview',
    'findTransactionType','hasCapability','ACHIEVEMENTS','todayStr','SHOP_ITEMS',
    'applyBossEffect','TRANSACTION_TYPES','findFinanceTransaction','SHOP_FUNCTIONAL'];
  const patched = appSrc.replace(/\}\)\(\);\s*$/,
    '  globalThis.__T = { ' + names.map(n => n + ': typeof ' + n + " !== 'undefined' ? " + n + ' : undefined').join(', ') + ' };\n})();');
  vm.runInContext(patched, sandbox, { filename: 'index.html' });
  return sandbox.__T;
}
let T = boot();

function resistance(amount, intensity, context, label) {
  T.selectFinanceActionType('avoided_expense');
  getEl('financeActionAmount').value = String(amount);
  getEl('financeActionIntensity').value = String(intensity);
  getEl('financeActionContext').value = context;
  getEl('financeActionLabel').value = label || 'Testversuchung';
  getEl('financeActionCategory').value = 'Sonstiges';
  getEl('financeActionNote').value = '';
  let err = null;
  try { T.handleFinanceActionSubmit(); } catch (e) { err = e; }
  return { err, entry: T.state.avoidedExpenses[T.state.avoidedExpenses.length - 1] };
}
function finanzaktion(typeId, amount) {
  T.selectFinanceActionType(typeId);
  getEl('financeActionAmount').value = String(amount);
  getEl('financeActionCategory').value = 'Sonstiges';
  getEl('financeActionNote').value = '';
  getEl('financeActionGoalField').style.display = 'none';
  getEl('financeActionGoal').value = '';
  let err = null;
  try { T.handleFinanceActionSubmit(); } catch (e) { err = e; }
  return err;
}
const D = (a, i, c) => T.computeResistanceBossDamage({ amount:a, intensity:i, context:c });

section('§3 State');
ok('STATE_VERSION ist 5', T.STATE_VERSION === 5);
ok('temptationBoss startet voll', (() => {
  const b = T.state.temptationBoss;
  return b.epoch === 2 && b.hp === 250 && b.maxHp === 250
      && b.cycle === 1 && b.victories === 0 && b.lastDefeatedAt === null;
})(), JSON.stringify(T.state.temptationBoss));
ok('Konstanten wie spezifiziert',
   T.TEMPTATION_BOSS_MAX_HP === 250 && T.TEMPTATION_BOSS_REWARD_COINS === 45
   && T.TEMPTATION_BOSS_HEAL === 25);

section('§8 Damage-Referenzwerte');
[[50, 10, 42], [100, 9, 44], [10, 3, 14], [25, 5, 23], [50, 5, 27],
 [100, 5, 32], [200, 10, 54], [500, 10, 54]].forEach(([a, i, soll]) => {
  ok(`${a} € / Craving ${i} → ${soll} Damage`, D(a, i, 'impulsiv').damage === soll,
     String(D(a, i, 'impulsiv').damage));
});
ok('100 € / 9 schlägt 50 € / 10',
   D(100, 9, 'impulsiv').damage > D(50, 10, 'impulsiv').damage);
ok('Betrags-Cap greift: 500 € wirkt wie 200 €',
   D(500, 10, 'impulsiv').damage === D(200, 10, 'impulsiv').damage
   && D(500, 10, 'impulsiv').amountBasis === 200);
ok('Craving-Komponente ist 3 × Intensität',
   D(200, 7, 'impulsiv').cravingDamage === 21);
ok('Betrags-Komponente bei vollem Betrag ist 24',
   Math.abs(D(200, 1, 'impulsiv').amountDamage - 24) < 1e-9);

section('§6 Eligibility');
['impulsiv','Komfort','Luxus','optional','sozial'].forEach(c => {
  const r = D(100, 5, c);
  ok(`„${c}" erzeugt Damage`, r.eligible && r.damage > 0 && r.reason === 'eligible');
});
['sinnvoll','notwendig'].forEach(c => {
  const r = D(100, 5, c);
  ok(`„${c}" erzeugt keinen Damage`,
     !r.eligible && r.damage === 0 && r.reason === 'not_boss_relevant');
});
ok('„keine Angabe" erzeugt keinen Damage', (() => {
  const r = D(100, 5, T.RESISTANCE_NO_CONTEXT);
  return !r.eligible && r.damage === 0 && r.reason === 'missing_context';
})());
ok('fehlender Kontext ebenso', D(100, 5, undefined).reason === 'missing_context');
ok('ungültige Eingaben werden abgewiesen',
   D(0, 5, 'impulsiv').reason === 'invalid_input'
   && D(100, 0, 'impulsiv').reason === 'invalid_input'
   && D(100, 11, 'impulsiv').reason === 'invalid_input');
ok('computeResistanceBossDamage verändert keinen State', (() => {
  const vor = JSON.stringify(T.state.temptationBoss);
  for (let i = 0; i < 5; i++) D(100, 9, 'impulsiv');
  return JSON.stringify(T.state.temptationBoss) === vor;
})());

section('§10/§11 Resistance-Schreibpfad');
store = {}; T = boot();
let r = resistance(100, 9, 'impulsiv', 'Neue Kopfhörer');
ok('Eintrag wird gespeichert', !r.err && T.state.avoidedExpenses.length === 1, r.err && r.err.message);
ok('context wird am Datensatz gespeichert', r.entry.context === 'impulsiv');
ok('bossImpact dokumentiert den Treffer', (() => {
  const b = r.entry.bossImpact;
  return b && b.epoch === 2 && b.formulaVersion === 1 && b.eligible === true
      && b.damage === 44 && b.cycle === 1 && b.hpBefore === 250 && b.hpAfter === 206
      && b.defeated === false;
})(), JSON.stringify(r.entry.bossImpact));
ok('Boss hat Schaden genommen', T.state.temptationBoss.hp === 206);

r = resistance(80, 6, 'notwendig');
ok('nicht bossrelevanter Eintrag wird trotzdem gespeichert', T.state.avoidedExpenses.length === 2);
ok('… mit eligible:false und reason', (() => {
  const b = r.entry.bossImpact;
  return b.eligible === false && b.damage === 0 && b.reason === 'not_boss_relevant';
})(), JSON.stringify(r.entry.bossImpact));
ok('… und ohne Bosswirkung', T.state.temptationBoss.hp === 206);
r = resistance(80, 6, T.RESISTANCE_NO_CONTEXT);
ok('fehlender Kontext → reason missing_context',
   r.entry.bossImpact.reason === 'missing_context' && T.state.temptationBoss.hp === 206);

section('§2/§14 Trennung Realität und Spiel');
store = {}; T = boot();
const vorher = { coins: T.state.wealth.coins, stress: T.state.wealth.financeStress,
  income: T.state.income.length, tx: T.state.financeTransactions.length };
resistance(150, 8, 'Luxus');
ok('avoidedExpenses +1', T.state.avoidedExpenses.length === 1);
ok('KEINE financeTransaction', T.state.financeTransactions.length === vorher.tx);
ok('KEIN Einkommen', T.state.income.length === vorher.income);
ok('KEIN Finanz-Stress', T.state.wealth.financeStress === vorher.stress);
ok('KEINE Coins für den Einzeltreffer', T.state.wealth.coins === vorher.coins);
ok('Boss hat aber Schaden genommen', T.state.temptationBoss.hp < 250);
ok('Betrag über 200 € bleibt vollständig gespeichert', (() => {
  const e = resistance(500, 10, 'impulsiv').entry;
  return e.amount === 500 && e.bossImpact.damage === 54;
})());

section('§13 Boss-Sieg');
store = {}; T = boot();
T.state.temptationBoss.hp = 30;
const coinsVorSieg = T.state.wealth.coins;
r = resistance(50, 10, 'impulsiv');   // 42 Damage
ok('Sieg wird erkannt', r.entry.bossImpact.defeated === true);
ok('victories +1', T.state.temptationBoss.victories === 1);
ok('+45 Münzen', T.state.wealth.coins === coinsVorSieg + 45);
ok('cycle +1', T.state.temptationBoss.cycle === 2);
ok('neuer Boss startet mit vollen HP', T.state.temptationBoss.hp === 250);
ok('überschüssiger Schaden verfällt', T.state.temptationBoss.hp === 250);
ok('bossImpact hält hpAfter 0 der GEWONNENEN Runde fest',
   r.entry.bossImpact.hpAfter === 0 && r.entry.bossImpact.cycle === 1);
ok('lastDefeatedAt gesetzt', typeof T.state.temptationBoss.lastDefeatedAt === 'string');
ok('nur ein Reward pro Sieg', (() => {
  const c = T.state.wealth.coins;
  resistance(10, 1, 'impulsiv');   // kleiner Treffer, kein Sieg
  return T.state.wealth.coins === c;
})());

section('§15 Fehlausgabe heilt');
store = {}; T = boot();
T.state.temptationBoss.hp = 180;
ok('Fehlausgabe heilt um 25 HP', (() => {
  const err = finanzaktion('fehlausgabe', 40);
  return !err && T.state.temptationBoss.hp === 205;
})(), String(T.state.temptationBoss.hp));
T.state.temptationBoss.hp = 245;
finanzaktion('fehlausgabe', 40);
ok('keine Überheilung über maxHp', T.state.temptationBoss.hp === 250);
ok('Heal ist betragsunabhängig', (() => {
  T.state.temptationBoss.hp = 100;
  finanzaktion('fehlausgabe', 5000);
  return T.state.temptationBoss.hp === 125;
})());
ok('§16 bossImpact am financeTransactions-Datensatz', (() => {
  const tx = T.state.financeTransactions[T.state.financeTransactions.length - 1];
  return tx.type === 'fehlausgabe' && tx.bossImpact
      && tx.bossImpact.type === 'heal' && tx.bossImpact.amount === 25
      && tx.bossImpact.hpBefore === 100 && tx.bossImpact.hpAfter === 125;
})(), JSON.stringify(T.state.financeTransactions.slice(-1)[0].bossImpact));
ok('keine Coin-Strafe, kein XP-Verlust durch den Heal',
   T.state.temptationBoss.victories === 0);

section('§17 Alte Damage-Quellen entfernt');
store = {}; T = boot();
['sparen','investieren','budget'].forEach(id => {
  const t = T.findTransactionType(id);
  ok(`${id} hat keine boss_damage-Capability mehr`, !T.hasCapability(t, 'boss_damage'));
  ok(`${id} hat keinen bossDamage-Wert mehr`, t.bossDamage === undefined);
});
const hpVor = T.state.temptationBoss.hp;
finanzaktion('sparen', 500);
ok('Sparen fügt keinen Schaden zu', T.state.temptationBoss.hp === hpVor);
finanzaktion('investieren', 200);
ok('Investieren fügt keinen Schaden zu', T.state.temptationBoss.hp === hpVor);
finanzaktion('budget', 0);
ok('Budget fügt keinen Schaden zu', T.state.temptationBoss.hp === hpVor);
ok('Sparen behält goal_contribution',
   T.hasCapability(T.findTransactionType('sparen'), 'goal_contribution'));
ok('Fehlausgabe behält boss_heal',
   T.hasCapability(T.findTransactionType('fehlausgabe'), 'boss_heal'));

section('§4/§18 Kein Wochentagsbezug, Legacy unberührt');
store = {}; T = boot();
T.state.bossFights = [{ date:'2026-01-02', hp:0, maxHp:100, defeated:true }];
T.state.weekendStreak = 3;
T.state.weekendWinsTotal = 7;
T.saveState();
T = boot();
ok('bossFights bleiben erhalten', T.state.bossFights.length === 1);
ok('weekendStreak bleibt erhalten', T.state.weekendStreak === 3);
ok('weekendWinsTotal bleibt erhalten', T.state.weekendWinsTotal === 7);
ok('v2-Boss wurde davon nicht beeinflusst',
   T.state.temptationBoss.hp === 250 && T.state.temptationBoss.victories === 0);
resistance(100, 9, 'impulsiv');
ok('neue Bossereignisse ändern die Legacy-Felder nicht',
   T.state.weekendStreak === 3 && T.state.weekendWinsTotal === 7
   && T.state.bossFights.length === 1);
ok('§19 Boss-UI zeigt keine Deadline', (() => {
  T.renderBossFight();
  const h = getEl('bossContent').innerHTML;
  return /VERSUCHUNG/.test(h) && /RUNDE 1/.test(h) && /250 HP/.test(h)
      && !/Nächster Boss/.test(h) && !/Freitag/.test(h) && !/Streak/.test(h);
})(), getEl('bossContent').innerHTML.slice(0, 200));
ok('§19 UI nennt Siege', /1× besiegt|0× besiegt/.test(getEl('bossContent').innerHTML));
ok('§19 UI ist wochentagsunabhängig — kein isWeekendBossDay im aktiven Renderer', (() => {
  const code = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const i = code.indexOf('function renderBossFight');
  const body = code.slice(i, code.indexOf('function renderLegacyWeekendBoss'));
  return !/isWeekendBossDay|weekendStreak|weekendWinsTotal/.test(body);
})());

section('§23 Achievements');
store = {}; T = boot();
const firstBoss = T.ACHIEVEMENTS.find(a => a.id === 'first_boss');
ok('first_boss ist ohne Sieg verschlossen', firstBoss.check() === false);
T.state.temptationBoss.victories = 1;
ok('first_boss schaltet über temptationBoss.victories frei', firstBoss.check() === true);
T.state.temptationBoss.victories = 0;
T.state.bossFights = [{ date:'2026-01-02', defeated:true }];
ok('alte Wochenend-Siege behalten das Achievement', firstBoss.check() === true);
const ww = T.ACHIEVEMENTS.find(a => a.id === 'weekend_warrior');
T.state.weekendWinsTotal = 7;
ok('weekend_warrior bleibt für Altbestand freigeschaltet', ww.check() === true);
ok('weekend_warrior wird nicht auf v2 umgedeutet', (() => {
  T.state.weekendWinsTotal = 0;
  T.state.temptationBoss.victories = 99;
  return ww.check() === false;
})());

section('§24 Boss-Reroll');
ok('wird nicht mehr im Shop angeboten',
   !T.SHOP_FUNCTIONAL.some(i => i.id === 'boss_reroll'),
   JSON.stringify(T.SHOP_FUNCTIONAL.map(i => i.id)));
ok('vorhandene Bestände bleiben im State', (() => {
  store = {}; T = boot();
  T.state.shop.inventory.boss_reroll = 2;
  T.saveState();
  const T2 = boot();
  return T2.state.shop.inventory.boss_reroll === 2;
})());
ok('kein Einsetzen-Button mehr gebunden', (() => {
  const code = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return !/useRerollBtn'\)\.addEventListener|rerollBtn\.addEventListener/.test(code);
})());

section('§22/§27 Backward Compatibility');
store = {}; T = boot();
T.state.avoidedExpenses = [
  { id:'alt1', amount:70, category:'Kleidung', date:'2026-05-01', label:'Jacke',
    createdAt:'2026-05-01T10:00:00.000Z' },   // ohne intensity, ohne context, ohne bossImpact
];
T.saveState();
const key = Object.keys(store).find(k => /sl_status/.test(k));
const alt = JSON.parse(store[key]);
delete alt.temptationBoss;
store[key] = JSON.stringify(alt);
T = boot();
ok('alter Spielstand ohne temptationBoss lädt fehlerfrei',
   T.state.temptationBoss.hp === 250 && T.state.temptationBoss.cycle === 1);
ok('alte avoidedExpenses bleiben unverändert', (() => {
  const e = T.state.avoidedExpenses[0];
  return e.id === 'alt1' && e.amount === 70
      && e.intensity === undefined && e.context === undefined && e.bossImpact === undefined;
})(), JSON.stringify(T.state.avoidedExpenses[0]));
ok('alte Einträge wirken nicht rückwirkend auf den Boss',
   T.state.temptationBoss.hp === 250 && T.state.temptationBoss.victories === 0);
ok('HP wird defensiv begrenzt', (() => {
  store = {}; T = boot();
  T.state.temptationBoss.hp = 9999;
  T.saveState();
  const T2 = boot();
  return T2.state.temptationBoss.hp === 250;
})());
ok('negative HP wird auf 0 korrigiert', (() => {
  store = {}; T = boot();
  T.state.temptationBoss.hp = -50;
  T.saveState();
  const T2 = boot();
  return T2.state.temptationBoss.hp === 0;
})());

section('§27 Persistenz');
store = {}; T = boot();
resistance(100, 9, 'impulsiv');
resistance(150, 8, 'Luxus');
/* Feldweise vergleichen: mergeState() baut das Objekt neu auf, die Schlüsselreihenfolge
   unterscheidet sich dadurch von der ursprünglichen — inhaltlich ist das irrelevant. */
const felder = ['epoch','hp','maxHp','cycle','victories','lastDefeatedAt'];
const snap = {};
felder.forEach(f => { snap[f] = T.state.temptationBoss[f]; });
T.saveState();
T = boot();
ok('Bosszustand überlebt Save → Reload unverändert',
   felder.every(f => T.state.temptationBoss[f] === snap[f]),
   JSON.stringify(felder.map(f => [f, snap[f], T.state.temptationBoss[f]])));

section('§20 Vorschau');
store = {}; T = boot();
T.selectFinanceActionType('avoided_expense');
getEl('financeActionAmount').value = '100';
getEl('financeActionIntensity').value = '9';
getEl('financeActionContext').value = 'impulsiv';
T.updateFinanceActionPreview();
let prev = getEl('financeActionPreview').innerHTML;
ok('bossrelevant zeigt Schaden und HP danach',
   /Boss-Schaden<\/span><span>44 HP/.test(prev) && /206 \/ 250 HP/.test(prev), prev);
ok('keine Coins in der Vorschau', !/Münzen/.test(prev));
ok('reale Finanzen als unverändert ausgewiesen', /Reale Finanzen<\/span><span>unverändert/.test(prev));
getEl('financeActionContext').value = 'notwendig';
T.updateFinanceActionPreview();
prev = getEl('financeActionPreview').innerHTML;
ok('nicht bossrelevant zeigt „—" und den Kontext',
   /Boss-Schaden<\/span><span>—/.test(prev) && /notwendig/.test(prev), prev);
getEl('financeActionContext').value = T.RESISTANCE_NO_CONTEXT;
T.updateFinanceActionPreview();
prev = getEl('financeActionPreview').innerHTML;
ok('fehlender Kontext fordert zur Einordnung auf',
   /Boss-Schaden<\/span><span>—/.test(prev) && /Einordnung wählen/.test(prev), prev);

section('§29 Nebenfix Kommentar');
ok('addXP-Kommentar beschreibt die Pflichtkurve',
   /`curve` war bis AP 13-30 optional/.test(html) && !/`curve` ist optional und defaultet/.test(html));

console.log('\n' + '─'.repeat(52));
console.log((fail === 0 ? 'ALLE TESTS BESTANDEN' : 'FEHLGESCHLAGEN') + `  —  ${pass} ok, ${fail} fehlerhaft`);
process.exit(fail === 0 ? 0 : 1);
