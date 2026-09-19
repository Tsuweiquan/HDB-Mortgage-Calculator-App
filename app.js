/* ---------------------------------------------------------------
   HDB Cash Outlay Calculator
   Implements SPEC.md v1.1
   --------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);
const CURRENT_YEAR = new Date().getFullYear();

/* Bump this whenever the rules, rates or logic change. Deliberately a fixed
   date: rendering today's date would claim the app is current forever. */
const LAST_UPDATED = '2026-09-19';

const sgd = (n, dp = 0) =>
  'S$' + Number(Math.round(n * 100) / 100).toLocaleString('en-SG', {
    minimumFractionDigits: dp, maximumFractionDigits: dp,
  });
const pct = (n, dp = 1) => n.toFixed(dp) + '%';

/* ---------------------------------------------------------------
   Money inputs are plain text fields carrying thousands separators
   (REQ-UI-9). These read and write them.
   --------------------------------------------------------------- */
const MONEY_FIELDS = ['price', 'loanAmount', 'cpfOa', 'income', 'otherDebt',
                      'grant4', 'grant5', 'grantProx', 'grantOther'];

/* Digits only, so "1,000,000" and "1000000" both parse. */
const moneyValue = (id) => Number(String($(id).value).replace(/[^\d]/g, '')) || 0;

const setMoney = (id, n) => { $(id).value = Math.round(n).toLocaleString('en-SG'); };

/* Reformat in place while typing, keeping the caret beside the same digit. */
function formatMoneyField(el) {
  const before = el.value;
  const caret = el.selectionStart ?? before.length;
  const digitsBeforeCaret = before.slice(0, caret).replace(/[^\d]/g, '').length;

  const digits = before.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  const after = digits ? Number(digits).toLocaleString('en-SG') : '';
  if (after === before) return;
  el.value = after;

  if (document.activeElement !== el) return;
  let pos = 0, seen = 0;
  while (pos < after.length && seen < digitsBeforeCaret) {
    if (/\d/.test(after[pos])) seen++;
    pos++;
  }
  el.setSelectionRange(pos, pos);
}

/* ===============================================================
   REGULATORY CONSTANTS  (see SPEC.md §5 Constants Register)
   =============================================================== */

/* Residential BSD tiers effective 20 Feb 2023 (IRAS). */
const BSD_TIERS = [
  { upTo:   180000, rate: 0.01 },
  { upTo:   360000, rate: 0.02 },
  { upTo:  1000000, rate: 0.03 },
  { upTo:  1500000, rate: 0.04 },
  { upTo:  3000000, rate: 0.05 },
  { upTo: Infinity, rate: 0.06 },
];

const LEASE_TOTAL_YEARS   = 99;   // HDB lease length from TOP
const CPF_LEASE_AGE_CAP   = 95;   // lease must cover youngest buyer to this age
const MIN_LEASE_FINANCE   = 20;   // below this: no CPF, no housing loan
const LEASE_TAIL_YEARS    = 20;   // lease that must remain at loan maturity (MAS)
const MSR_CAP             = 0.30; // Mortgage Servicing Ratio — HDB flats & new ECs
const TDSR_CAP            = 0.55; // Total Debt Servicing Ratio — all property loans
const STRESS_RATE_FLOOR   = 4.0;  // % p.a. floor for MSR/TDSR assessment
const AGE_TENURE_LIMIT    = 65;   // age + tenure beyond this reduces LTV
const MAX_TENURE          = { hdb: 25, bank: 30 };
const FULL_LTV_MAX_TENURE = 25;   // bank loan on an HDB flat: beyond this, LTV 55%
const HEADLINE_LTV        = 75;   // % — the published starting LTV
const REDUCED_LTV         = 55;   // % — LTV when tenure/age conditions are breached
const BANK_CASH_FLOOR     = 0.05; // 5% of price must be cash on a bank loan

const PRESETS = {
  custom: {
    g4: 25000, g5: 10000, prox: 10000,
    hint: 'Your own figures, as specified. Every amount below stays editable.',
  },
  official: {
    g4: 80000, g5: 50000, prox: 20000,
    hint: 'HDB 2026 published amounts: CPF Housing Grant $80k (4-room & below) / $50k (5-room & above) for first-timer families; PHG $20k for living near parents ($30k if moving in with them). Excludes EHG — add that under "Other grants".',
  },
};

/* ===============================================================
   FINANCE PRIMITIVES
   =============================================================== */

/* Buyer's Stamp Duty, banded. */
function buyerStampDuty(price) {
  const rows = [];
  let duty = 0, prev = 0;
  for (const t of BSD_TIERS) {
    if (price <= prev) break;
    const slice = Math.min(price, t.upTo) - prev;
    const amt = slice * t.rate;
    duty += amt;
    rows.push({ rate: t.rate, amt, from: prev, to: Math.min(price, t.upTo) });
    prev = t.upTo;
  }
  return { duty, rows };
}

/* Monthly instalment on a principal. */
function monthlyPayment(principal, annualRatePct, years) {
  const n = Math.max(1, Math.round(years * 12));
  const i = annualRatePct / 100 / 12;
  if (principal <= 0) return 0;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/* Principal supportable by a given monthly instalment — the inverse. */
function principalFromPayment(payment, annualRatePct, years) {
  const n = Math.max(1, Math.round(years * 12));
  const i = annualRatePct / 100 / 12;
  if (payment <= 0) return 0;
  if (i === 0) return payment * n;
  return (payment * (1 - Math.pow(1 + i, -n))) / i;
}

/* ===============================================================
   LEASE MODEL  (REQ-FLAT-5, REQ-LOAN-11..15)
   =============================================================== */
function leaseProfile(topYear, age) {
  const yearsElapsed = Math.max(0, CURRENT_YEAR - topYear);
  const remaining = Math.max(0, LEASE_TOTAL_YEARS - yearsElapsed);
  const yearsTo95 = Math.max(0, CPF_LEASE_AGE_CAP - age);
  const coversTo95 = remaining >= yearsTo95;
  /* Pro-ration: the fraction of the buyer's need-to-95 that the lease covers. */
  const ratio = yearsTo95 <= 0 ? 1 : Math.min(1, remaining / yearsTo95);
  return {
    topYear, yearsElapsed, remaining, yearsTo95, coversTo95,
    ratio, financeable: remaining > MIN_LEASE_FINANCE,
  };
}

/* ===============================================================
   INPUT / COMPUTE
   =============================================================== */
let proximity = { distanceKm: null, eligible: false };
let ltvAuto = true;   // false once the user types their own target LTV

const trimPct = (n) => n.toFixed(2).replace(/\.?0+$/, '');

function readInputs() {
  const num = (id, min = 0) => Math.max(min, Number($(id).value) || 0);
  const mny = (id) => Math.max(0, moneyValue(id));
  return {
    price:      mny('price'),
    roomType:   $('roomType').value,
    topYear:    Number($('topYear').value) || CURRENT_YEAR,
    age:        Math.min(80, Math.max(21, Number($('age').value) || 21)),
    income:     mny('income'),
    otherDebt:  mny('otherDebt'),
    loanType:   $('loanType').value,
    mode:       document.querySelector('input[name="loanMode"]:checked').value,
    ltvPct:     Math.min(100, Math.max(0, Number($('ltv').value) || 0)),
    ltvAuto,
    loanAmount: mny('loanAmount'),
    tenureReq:  Math.max(1, Number($('tenure').value) || 1),
    stressRate: Math.max(0, Number($('stressRate').value) || 0),
    cpfOa:      mny('cpfOa'),
    grantOn:    $('grantEligible').checked,
    grant4:     mny('grant4'),
    grant5:     mny('grant5'),
    grantProx:  mny('grantProx'),
    grantOther: mny('grantOther'),
    bsdFromCpf: $('bsdFromCpf').checked,
  };
}

function compute(i) {
  const lease = leaseProfile(i.topYear, i.age);

  /* ---- tenure cap: shortest of policy max, age-65 rule, lease tail ---- */
  const capPolicy = MAX_TENURE[i.loanType];
  const capAge    = Math.max(0, AGE_TENURE_LIMIT - i.age);
  const capLease  = Math.max(0, lease.remaining - LEASE_TAIL_YEARS);
  const tenureMax = Math.min(capPolicy, capAge, capLease);
  const tenure    = Math.max(1, Math.min(i.tenureReq, tenureMax));
  const tenureClamped = i.tenureReq > tenureMax;
  const tenureBinding =
    tenureMax === capLease  ? 'remaining lease' :
    tenureMax === capAge    ? 'age 65 rule'     : 'policy maximum';

  /* ---- LTV: headline, then age/tenure reduction, then lease pro-ration.
         The cap is derived from the rules; the field is a target that cannot
         exceed it. Applying min() rather than multiplying by the ratio keeps
         the value idempotent when the cap is written back into the field. ---- */
  const ltvReducedByAge =
    i.loanType === 'bank' && (tenure > FULL_LTV_MAX_TENURE || tenure + i.age > AGE_TENURE_LIMIT);
  const ltvBase = ltvReducedByAge ? REDUCED_LTV : HEADLINE_LTV;

  /* The age-95 pro-ration is a CPF / HDB-loan rule. A bank loan is governed
     instead by the tenure-and-age test above plus the lease tail in the tenure
     cap, so its LTV is not pro-rated. CPF usage is pro-rated either way. */
  const ltvProRated = i.loanType === 'hdb' && lease.ratio < 1;
  const ltvCapPct = !lease.financeable ? 0
                  : (ltvProRated ? ltvBase * lease.ratio : ltvBase);
  const ltvEffective = i.ltvAuto ? ltvCapPct : Math.max(0, Math.min(i.ltvPct, ltvCapPct));
  const capLtvLoan = i.price * (ltvEffective / 100);

  /* ---- MSR / TDSR: this is an HDB flat, so MSR always applies ---- */
  const rate = Math.max(i.stressRate, 0);
  const msrApplies = true;
  const incomeKnown = i.income > 0;

  const msrInstalCap  = i.income * MSR_CAP;
  const tdsrInstalCap = Math.max(0, i.income * TDSR_CAP - i.otherDebt);

  const capMsrLoan  = incomeKnown ? principalFromPayment(msrInstalCap,  rate, tenure) : Infinity;
  const capTdsrLoan = incomeKnown ? principalFromPayment(tdsrInstalCap, rate, tenure) : Infinity;

  /* ---- the requested loan, then every cap applied ---- */
  const requested = i.mode === 'manual' ? i.loanAmount : i.price * (i.ltvPct / 100);
  const caps = [
    { key: 'request', label: i.mode === 'manual' ? 'your stated loan' : 'requested LTV', value: requested },
    { key: 'ltv',     label: 'LTV limit',   value: capLtvLoan },
    { key: 'msr',     label: 'MSR (30%)',   value: capMsrLoan },
    { key: 'tdsr',    label: 'TDSR (55%)',  value: capTdsrLoan },
    { key: 'price',   label: 'flat price',  value: i.price },
  ];
  const binding = caps.reduce((a, b) => (b.value < a.value ? b : a));
  const loan = Math.max(0, Math.min(...caps.map(c => c.value)));

  /* ---- servicing ratios on the loan actually granted ---- */
  const instalment = monthlyPayment(loan, rate, tenure);
  const msrPct  = incomeKnown ? (instalment / i.income) * 100 : null;
  const tdsrPct = incomeKnown ? ((instalment + i.otherDebt) / i.income) * 100 : null;

  /* ---- downpayment ---- */
  const downpayment = i.price - loan;

  /* ---- grants ---- */
  const bigFlat = i.roomType === '5' || i.roomType === 'exec';
  const flatGrant = !i.grantOn ? 0 : (bigFlat ? i.grant5 : i.grant4);
  const flatGrantLabel = bigFlat ? '5-room & above grant' : '4-room & below grant';
  const proxGrant = proximity.eligible ? i.grantProx : 0;
  const grantsTotal = flatGrant + proxGrant + i.grantOther;

  /* ---- stamp duty ---- */
  const { duty: bsd, rows: bsdRows } = buyerStampDuty(i.price);

  /* ---- CPF: Valuation Limit pro-rated by the same lease ratio ---- */
  const cpfVlCap = lease.financeable ? i.price * lease.ratio : 0;
  const cpfPoolRaw = i.cpfOa + grantsTotal;
  const cpfPool = Math.min(cpfPoolRaw, cpfVlCap);
  const cpfBlocked = cpfPoolRaw - cpfPool;

  /* ---- cash floor for bank loans ---- */
  const minCash = i.loanType === 'bank' ? i.price * BANK_CASH_FLOOR : 0;

  const cpfUsableOnDp = Math.max(0, downpayment - minCash);
  const cpfAppliedToDp = Math.min(cpfPool, cpfUsableOnDp);
  const cashForDownpayment = downpayment - cpfAppliedToDp;

  /* Grants are disbursed into the OA and must be spent on the flat, so they
     are applied first; the buyer's own OA covers whatever is still owing.
     grantsApplied + cpfOaApplied === cpfAppliedToDp. */
  const grantsApplied = Math.min(grantsTotal, cpfAppliedToDp);
  const cpfOaApplied  = cpfAppliedToDp - grantsApplied;
  const grantsUnused  = grantsTotal - grantsApplied;
  const cpfOaUnused   = i.cpfOa - cpfOaApplied;

  const cpfLeftoverRaw = cpfPool - cpfAppliedToDp;
  const bsdFromCpf = i.bsdFromCpf ? Math.min(cpfLeftoverRaw, bsd) : 0;
  const bsdCash = bsd - bsdFromCpf;

  const cashNeeded = cashForDownpayment + bsdCash;
  const shortfall = Math.max(0, downpayment - cpfPool);

  return {
    ...i, lease, tenure, tenureMax, tenureClamped, tenureBinding,
    ltvBase, ltvCapPct, ltvEffective, ltvReducedByAge, ltvProRated, capLtvLoan, capMsrLoan, capTdsrLoan,
    msrApplies, incomeKnown, rate, instalment, msrPct, tdsrPct, binding, loan,
    downpayment, flatGrant, flatGrantLabel, proxGrant, grantsTotal,
    bsd, bsdRows, cpfVlCap, cpfPool, cpfBlocked, minCash, cpfAppliedToDp,
    cashForDownpayment, grantsApplied, cpfOaApplied, grantsUnused, cpfOaUnused,
    cpfLeftover: cpfLeftoverRaw - bsdFromCpf, bsdFromCpf, bsdCash,
    cashNeeded, shortfall,
    dpPct: i.price > 0 ? (downpayment / i.price) * 100 : 0,
  };
}

/* ===============================================================
   RENDERING
   =============================================================== */

function renderLeaseBox(r) {
  const L = r.lease;
  if (!r.topYear) { $('leaseBox').innerHTML = ''; return; }
  const cls = !L.financeable ? 'bad' : (L.coversTo95 ? 'ok' : 'warn');
  let msg;
  if (!L.financeable) {
    msg = `<strong>${L.remaining} years</strong> of lease remain — at or below the ${MIN_LEASE_FINANCE}-year floor. No CPF and no housing loan may be used; this would be a cash purchase.`;
  } else if (L.coversTo95) {
    msg = `<strong>${L.remaining} years</strong> of lease remain, covering the youngest buyer (age ${r.age}) to age ${CPF_LEASE_AGE_CAP}. Full CPF and full LTV available.`;
  } else if (r.loanType === 'hdb') {
    msg = `<strong>${L.remaining} years</strong> of lease remain, but the youngest buyer (age ${r.age}) needs <strong>${L.yearsTo95} years</strong> to reach age ${CPF_LEASE_AGE_CAP}. On an HDB loan, CPF and LTV are both pro-rated to <strong>${pct(L.ratio * 100)}</strong> (${L.remaining} ÷ ${L.yearsTo95}).`;
  } else {
    msg = `<strong>${L.remaining} years</strong> of lease remain, but the youngest buyer (age ${r.age}) needs <strong>${L.yearsTo95} years</strong> to reach age ${CPF_LEASE_AGE_CAP}. CPF usage is pro-rated to <strong>${pct(L.ratio * 100)}</strong> (${L.remaining} ÷ ${L.yearsTo95}), but the <strong>bank LTV is not</strong> — a bank loan is limited by the tenure and age-65 tests instead, and the ${r.tenure}-year tenure leaves ${L.remaining - r.tenure} years of lease at maturity.`;
  }
  const usedPct = Math.min(100, (L.yearsElapsed / LEASE_TOTAL_YEARS) * 100);
  const bar =
    `<div class="leasebar">` +
      `<i style="width:${usedPct}%;background:var(--line-strong)"></i>` +
      `<i style="width:${100 - usedPct}%;background:var(--cat-loan)"></i>` +
    `</div>` +
    `<div class="lease-ends"><span>${L.yearsElapsed} years used</span>` +
    `<strong>${L.remaining} years left</strong></div>`;

  $('leaseBox').innerHTML =
    `<div class="ib ${cls}"><span class="ib-h">Lease · TOP ${L.topYear}</span>${msg}${bar}</div>`;
}

function renderTenureBox(r) {
  if (!r.lease.financeable) {
    $('tenureBox').innerHTML =
      `<div class="ib bad"><span class="ib-h">Loan tenure</span>No housing loan is available on this lease, so there is no tenure to set.</div>`;
    return;
  }
  const cls = r.tenureClamped ? 'warn' : 'ok';
  const msg = r.tenureClamped
    ? `Requested ${r.tenureReq} years, capped at <strong>${r.tenureMax} years</strong> by the ${r.tenureBinding}.`
    : `Tenure <strong>${r.tenure} years</strong>. Maximum allowed is ${r.tenureMax}, set by the ${r.tenureBinding}.`;
  const ltvNote = r.ltvReducedByAge
    ? `<br>LTV cut to ${REDUCED_LTV}%: a bank loan on an HDB flat must run ≤ ${FULL_LTV_MAX_TENURE} years and finish by age ${AGE_TENURE_LIMIT}.`
    : '';
  $('tenureBox').innerHTML =
    `<div class="ib ${cls}"><span class="ib-h">Loan tenure</span>${msg}${ltvNote}</div>`;
}

function renderMsrBox(r) {
  if (!r.incomeKnown) {
    $('msrBox').innerHTML =
      `<div class="ib warn"><span class="ib-h">MSR not assessed</span>Enter a gross monthly income to apply the 30% Mortgage Servicing Ratio cap.</div>`;
    return;
  }
  const bar = (label, val, cap, capPctLabel) => {
    const w = Math.min(100, (val / cap) * 100);
    const over = val > cap;
    return `<div class="bar-row">
      <div class="bar-lbl"><span>${label}</span><span class="${over ? 'over' : ''}">${pct(val)} / ${capPctLabel}</span></div>
      <div class="bar"><i style="width:${w}%" class="${over ? 'over' : ''}"></i></div>
    </div>`;
  };
  $('msrBox').innerHTML = `<div class="ib ${r.msrPct > 30.01 ? 'bad' : 'ok'}">
    <span class="ib-h">Servicing ratios at ${r.rate}% over ${r.tenure} years</span>
    Instalment <strong>${sgd(r.instalment)}/month</strong> on a ${sgd(r.loan)} loan.
    ${bar('MSR', r.msrPct, 30, '30%')}
    ${bar('TDSR', r.tdsrPct, 55, '55%')}
    MSR caps the loan at <strong>${sgd(r.capMsrLoan)}</strong>; TDSR at ${sgd(r.capTdsrLoan)}.
  </div>`;
}

function renderCpfCapBox(r) {
  if (r.cpfBlocked <= 0.5) { $('cpfCapBox').innerHTML = ''; return; }
  $('cpfCapBox').innerHTML = `<div class="ib warn"><span class="ib-h">CPF capped by lease</span>
    The pro-rated Valuation Limit allows only <strong>${sgd(r.cpfVlCap)}</strong> of CPF on this flat,
    so ${sgd(r.cpfBlocked)} of your OA and grants cannot be used towards the purchase.</div>`;
}

function renderRatioCard(r) {
  if (r.price <= 0) { $('ratioCard').innerHTML = ''; return; }
  const bindLabel = r.binding.key === 'request' ? 'your request' : r.binding.label;
  $('ratioCard').innerHTML = `
    <div class="rc-row"><span>Loan granted</span><strong>${sgd(r.loan)}</strong></div>
    <div class="rc-row"><span>Effective LTV</span><strong>${pct(r.price ? (r.loan / r.price) * 100 : 0)}</strong></div>
    <div class="rc-row"><span>Monthly instalment</span><strong>${sgd(r.instalment)}</strong></div>
    <div class="rc-row"><span>MSR</span><strong class="${r.msrPct > 30.01 ? 'over' : ''}">${r.msrPct === null ? '—' : pct(r.msrPct)}</strong></div>
    <div class="rc-row"><span>TDSR</span><strong class="${r.tdsrPct > 55.01 ? 'over' : ''}">${r.tdsrPct === null ? '—' : pct(r.tdsrPct)}</strong></div>
    <div class="rc-bind">Loan is capped by <strong>${bindLabel}</strong></div>`;
}

function renderCapitalStack(r) {
  if (r.price <= 0) { $('stackCard').innerHTML = ''; return; }

  /* The four sources that add up to the price. Cash is the remainder,
     so the segments always total exactly 100%. */
  const segs = [
    { key: 'loan',  label: 'Housing loan', value: r.loan,               v: '--cat-loan',  ink: '--cat-loan' },
    { key: 'cpf',   label: 'CPF OA',       value: r.cpfOaApplied,       v: '--cat-cpf',   ink: '--cat-cpf-ink' },
    { key: 'grant', label: 'Grants',       value: r.grantsApplied,      v: '--cat-grant', ink: '--cat-grant-ink' },
    { key: 'cash',  label: 'Your cash',    value: r.cashForDownpayment, v: '--cat-cash',  ink: '--cat-cash' },
  ].filter(s => s.value > 0.5);

  const total = segs.reduce((a, b) => a + b.value, 0) || 1;

  const bar = segs.map(s =>
    `<i style="width:${(s.value / total) * 100}%;background:var(${s.v})" title="${s.label}: ${sgd(s.value)}"></i>`
  ).join('');

  /* Direct labels carry identity, so the two low-contrast hues never
     stand alone as colour (dataviz: relief for a sub-3:1 swatch). */
  const legend = segs.map(s =>
    `<div><span class="sw" style="background:var(${s.v})"></span>` +
    `<span>${s.label}</span><strong>${sgd(s.value)}</strong>` +
    `<span>${((s.value / total) * 100).toFixed(1)}%</span></div>`
  ).join('');

  $('stackCard').innerHTML =
    `<div class="stack-h">How the ${sgd(r.price)} is paid</div>` +
    `<div class="stack-bar">${bar}</div>` +
    `<div class="stack-legend">${legend}</div>`;
}

function renderBsdTable(r) {
  if (r.price <= 0) { $('bsdBreakdown').innerHTML = ''; return; }
  const rows = r.bsdRows.map(t =>
    `<tr><td class="muted">${(t.rate * 100).toFixed(0)}% on ${sgd(t.from)} – ${sgd(t.to)}</td><td>${sgd(t.amt)}</td></tr>`
  ).join('');
  $('bsdBreakdown').innerHTML =
    `<table>${rows}<tr><td>Buyer's Stamp Duty</td><td>${sgd(r.bsd)}</td></tr></table>`;
}

function renderBreakdown(r) {
  const row = (label, val, cls = '', sub = '') =>
    `<tr class="${cls}"><td>${label}</td><td>${val}</td></tr>` +
    (sub ? `<tr class="sub"><td colspan="2">${sub}</td></tr>` : '');
  const sect = (t) => `<tr class="sect"><td colspan="2">${t}</td></tr>`;

  let h = '';

  h += sect('Purchase');
  h += row('Flat price', sgd(r.price));
  h += row(`Loan (${pct(r.price ? (r.loan / r.price) * 100 : 0)} LTV)`, '− ' + sgd(r.loan),
    '', r.binding.key !== 'request' ? `Capped by ${r.binding.label}.` : '');
  h += row(`<strong>Downpayment (${r.dpPct.toFixed(1)}%)</strong>`, '<strong>' + sgd(r.downpayment) + '</strong>', 'total');

  h += sect('Funding the downpayment');

  h += row('Less CPF Ordinary Account', '− ' + sgd(r.cpfOaApplied), 'neg',
    r.cpfOaUnused > 0.5 ? `${sgd(r.cpfOaUnused)} of your OA is not needed and stays untouched.` : '');

  h += row('Less housing grants', '− ' + sgd(r.grantsApplied), 'neg');

  /* Composition of that grants line — detail, not a further deduction. */
  const parts = [];
  if (r.grantOn && r.flatGrant > 0) parts.push([r.flatGrantLabel, sgd(r.flatGrant)]);
  if (r.proxGrant > 0) {
    parts.push([`Proximity grant (${proximity.distanceKm.toFixed(2)} km)`, sgd(r.proxGrant)]);
  } else if (proximity.distanceKm !== null) {
    parts.push([`Proximity grant (${proximity.distanceKm.toFixed(2)} km)`, 'not eligible']);
  } else {
    parts.push(['Proximity grant', 'not checked']);
  }
  if (r.grantOther > 0) parts.push(['Other grants', sgd(r.grantOther)]);
  h += parts.map(([k, v]) => `<tr class="detail"><td>${k}</td><td>${v}</td></tr>`).join('');

  if (r.grantsUnused > 0.5) {
    h += `<tr class="sub"><td colspan="2">${sgd(r.grantsUnused)} of grant money is not needed for the downpayment and remains in the OA.</td></tr>`;
  }
  if (r.minCash > 0) {
    h += `<tr class="sub"><td colspan="2">CPF is capped so that ${sgd(r.minCash)} (5% of price) stays in cash — required for bank loans.</td></tr>`;
  }
  if (r.cpfBlocked > 0.5) {
    h += `<tr class="sub"><td colspan="2">${sgd(r.cpfBlocked)} blocked by the pro-rated Valuation Limit.</td></tr>`;
  }

  h += row('<strong>Cash for downpayment</strong>', '<strong>' + sgd(r.cashForDownpayment) + '</strong>', 'total');

  h += sect('Stamp duty');
  h += row("Buyer's Stamp Duty", sgd(r.bsd));
  if (r.bsdFromCpf > 0) h += row('Paid from leftover CPF', '− ' + sgd(r.bsdFromCpf), 'neg');
  h += row('<strong>Stamp duty in cash</strong>', '<strong>' + sgd(r.bsdCash) + '</strong>', 'total');

  h += sect('Cash to fork out');
  h += row('Cash for downpayment', sgd(r.cashForDownpayment));
  h += row('Stamp duty in cash', '+ ' + sgd(r.bsdCash));
  h += row('<strong>Total cash</strong>', '<strong>' + sgd(r.cashNeeded) + '</strong>', 'total');

  $('breakdown').innerHTML = h;
}

function renderNotes(r) {
  const n = [];

  if (!r.lease.financeable) {
    n.push(`<div class="note"><strong>Lease below ${MIN_LEASE_FINANCE} years.</strong> Neither CPF nor a housing loan may be used — the full price plus stamp duty must be cash.</div>`);
  }
  if (r.binding.key === 'msr') {
    n.push(`<div class="note"><strong>MSR is the binding constraint.</strong> The 30% cap limits the loan to ${sgd(r.capMsrLoan)}, ${sgd(r.capLtvLoan - r.capMsrLoan)} below what the LTV rules alone would allow — and every dollar of that gap becomes cash or CPF you must find upfront.</div>`);
  }
  if (r.binding.key === 'tdsr') {
    n.push(`<div class="note"><strong>TDSR is the binding constraint.</strong> Existing debts of ${sgd(r.otherDebt)}/month limit the loan to ${sgd(r.capTdsrLoan)}. Clearing them raises your borrowing power.</div>`);
  }
  if (r.ltvReducedByAge) {
    n.push(`<div class="note"><strong>LTV reduced to ${REDUCED_LTV}%.</strong> A bank loan on an HDB flat keeps the 75% limit only if the tenure is ${FULL_LTV_MAX_TENURE} years or less and ends by age ${AGE_TENURE_LIMIT}.</div>`);
  }
  if (r.lease.financeable && !r.lease.coversTo95) {
    n.push(r.ltvProRated
      ? `<div class="note"><strong>Lease does not reach age ${CPF_LEASE_AGE_CAP}.</strong> On an HDB loan both CPF and LTV are pro-rated to ${pct(r.lease.ratio * 100)}, raising the cash you need.</div>`
      : `<div class="note"><strong>Lease does not reach age ${CPF_LEASE_AGE_CAP}.</strong> CPF usage is pro-rated to ${pct(r.lease.ratio * 100)}, but the bank LTV is unaffected. An HDB loan on the same flat would be pro-rated to ${trimPct(r.ltvBase * r.lease.ratio)}%.</div>`);
  }
  if (r.shortfall > 0) {
    n.push(`<div class="note"><strong>Shortfall of ${sgd(r.shortfall)}.</strong> Your usable CPF plus grants do not cover the downpayment, so the balance has to come from cash.</div>`);
  }
  if (r.minCash > 0) {
    n.push(`<div class="note"><strong>Bank loan:</strong> at least ${sgd(r.minCash)} (5% of the price) must be paid in cash — CPF cannot be used for that portion.</div>`);
  } else if (r.cashForDownpayment === 0 && r.price > 0) {
    n.push(`<div class="note ok">Your CPF and grants cover the entire downpayment. Only stamp duty needs cash.</div>`);
  }
  if (r.cpfLeftover > 0 && r.price > 0) {
    n.push(`<div class="note ok"><strong>${sgd(r.cpfLeftover)}</strong> stays in your CPF OA after the purchase — useful as a monthly-instalment buffer.</div>`);
  }
  if (proximity.distanceKm === null && r.price > 0) {
    n.push(`<div class="note">Proximity grant not counted yet — enter both postal codes and hit <em>Measure distance</em>.</div>`);
  }
  n.push(`<div class="note">Not included: option fee / deposit (paid earlier and offset at completion), conveyancing fees, HDB resale application fees, valuation, agent commission, resale levy and cash-over-valuation.</div>`);

  $('notes').innerHTML = n.join('');
}

function renderLtvField(r) {
  const cap = trimPct(r.ltvCapPct);
  if (ltvAuto && $('ltv').value !== cap) $('ltv').value = cap;

  const btn = $('ltvAutoBtn');
  btn.hidden = ltvAuto;
  btn.textContent = `Reset to ${cap}%`;

  let hint;
  if (!r.lease.financeable) {
    hint = `No loan is available on a lease of ${r.lease.remaining} years.`;
  } else if (r.ltvProRated) {
    hint = `${r.ltvBase}% ${r.ltvReducedByAge ? '(reduced by the tenure/age rule)' : 'headline'}
            × ${trimPct(r.lease.ratio * 100)}% lease pro-ration = <strong>${cap}%</strong>, the most an HDB loan can carry on this lease.`;
  } else if (r.lease.ratio < 1) {
    hint = `<strong>${cap}%</strong> — a bank loan is not pro-rated by the age-95 rule, so the lease does not reduce it.
            Your CPF usage is still pro-rated to ${trimPct(r.lease.ratio * 100)}%.`;
  } else {
    hint = `${r.ltvBase}% ${r.ltvReducedByAge ? '(reduced by the tenure/age rule)' : 'headline'} — the lease covers the youngest buyer to ${CPF_LEASE_AGE_CAP}, so there is no pro-ration.`;
  }
  if (!ltvAuto && r.ltvEffective < r.ltvCapPct) {
    hint += ` You have set a lower target of ${trimPct(r.ltvEffective)}%.`;
  }
  $('ltvHint').innerHTML = hint;
}

function recalc() {
  const r = compute(readInputs());
  renderLtvField(r);
  $('cashOut').textContent = sgd(r.cashNeeded);
  $('cashSub').textContent = r.price > 0
    ? `${sgd(r.cashForDownpayment)} downpayment + ${sgd(r.bsdCash)} stamp duty`
    : 'Enter a flat price to begin.';
  renderLeaseBox(r);
  renderTenureBox(r);
  renderMsrBox(r);
  renderCpfCapBox(r);
  renderRatioCard(r);
  renderCapitalStack(r);
  renderBsdTable(r);
  renderBreakdown(r);
  renderNotes(r);
}

/* ===============================================================
   PDF EXPORT  (REQ-PDF-1..8)
   Builds a standalone report from the current result and hands it
   to the browser's print dialog, where "Save as PDF" produces
   selectable vector text — no library, no network.
   =============================================================== */
function buildPrintReport(r) {
  const today = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = (pairs) => pairs.filter(Boolean)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

  const roomLabel = { '2': '2-room Flexi', '3': '3-room', '4': '4-room',
                      '5': '5-room', 'exec': 'Executive / Maisonette' }[r.roomType] || r.roomType;

  const inputs = rows([
    ['Room type', roomLabel],
    ['Purchase price', sgd(r.price)],
    ['TOP year', `${r.topYear} — ${r.lease.remaining} years of lease remaining`],
    ['Age of youngest buyer', r.age],
    ['Gross monthly income', r.income ? sgd(r.income) : 'not stated'],
    r.otherDebt > 0 && ['Other monthly debts', sgd(r.otherDebt)],
    ['Loan type', r.loanType === 'hdb' ? 'HDB concessionary loan' : 'Bank loan'],
    ['Loan tenure', `${r.tenure} years (max ${r.tenureMax}, set by the ${r.tenureBinding})`],
    ['Stress-test rate', `${r.rate}% p.a.`],
    ['CPF Ordinary Account', sgd(r.cpfOa)],
  ]);

  const lease = r.lease.financeable
    ? (r.lease.coversTo95
        ? `${r.lease.remaining} years remaining, covering the youngest buyer to age ${CPF_LEASE_AGE_CAP}. No pro-ration.`
        : `${r.lease.remaining} years remaining against ${r.lease.yearsTo95} needed to reach age ${CPF_LEASE_AGE_CAP}. CPF and LTV pro-rated to ${trimPct(r.lease.ratio * 100)}%.`)
    : `${r.lease.remaining} years remaining — below the ${MIN_LEASE_FINANCE}-year floor. No CPF and no housing loan.`;

  const financing = rows([
    ['Lease position', lease],
    ['LTV cap', r.ltvProRated
        ? `${r.ltvBase}% × ${trimPct(r.lease.ratio * 100)}% lease pro-ration = ${trimPct(r.ltvCapPct)}% → ${sgd(r.capLtvLoan)}`
        : `${trimPct(r.ltvCapPct)}% → ${sgd(r.capLtvLoan)}${r.lease.ratio < 1 ? ' (bank LTV not pro-rated by the age-95 rule)' : ''}`],
    r.incomeKnown && ['MSR cap (30%)', sgd(r.capMsrLoan)],
    r.incomeKnown && ['TDSR cap (55%)', sgd(r.capTdsrLoan)],
    ['Loan granted', `${sgd(r.loan)} — capped by ${r.binding.key === 'request' ? 'your request' : r.binding.label}`],
    ['Effective LTV', trimPct(r.price ? (r.loan / r.price) * 100 : 0) + '%'],
    ['Monthly instalment', `${sgd(r.instalment)} at ${r.rate}% over ${r.tenure} years`],
    r.incomeKnown && ['MSR', `${r.msrPct.toFixed(1)}% of gross income (cap 30%)`],
    r.incomeKnown && ['TDSR', `${r.tdsrPct.toFixed(1)}% of gross income (cap 55%)`],
  ]);

  const prox = proximity.distanceKm === null
    ? '<tr><td>Proximity</td><td>Not measured</td></tr>'
    : rows([['Distance between flats', `${proximity.distanceKm.toFixed(2)} km (straight line)`],
            ['Proximity grant', proximity.eligible ? `${sgd(r.proxGrant)} — within 4 km` : 'Not eligible — beyond 4 km']]);

  $('printReport').innerHTML = `
    <div class="pr-head">
      <h1>HDB Cash Outlay Report</h1>
      <p>Prepared ${today} · Calculator last updated ${new Date(LAST_UPDATED + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>

    <div class="pr-hero">
      <span>Cash to fork out</span>
      <strong>${sgd(r.cashNeeded)}</strong>
      <em>${sgd(r.cashForDownpayment)} downpayment + ${sgd(r.bsdCash)} stamp duty</em>
    </div>

    <h2>Inputs</h2>
    <table class="pr-table">${inputs}</table>

    <h2>Financing</h2>
    <table class="pr-table">${financing}</table>

    <h2>Grants</h2>
    <table class="pr-table">${rows([
      [r.flatGrantLabel, r.grantOn ? sgd(r.flatGrant) : 'Not eligible'],
      r.grantOther > 0 && ['Other grants', sgd(r.grantOther)],
      ['Total grants', sgd(r.grantsTotal)],
    ])}${prox}</table>

    <h2>Buyer's Stamp Duty</h2>
    <table class="pr-table">${r.bsdRows.map(t =>
      `<tr><td>${(t.rate * 100).toFixed(0)}% on ${sgd(t.from)} – ${sgd(t.to)}</td><td>${sgd(t.amt)}</td></tr>`).join('')}
      <tr class="pr-tot"><td>Total stamp duty</td><td>${sgd(r.bsd)}</td></tr></table>

    <h2>Cash outlay</h2>
    <table class="pr-table">${rows([
      ['Flat price', sgd(r.price)],
      ['Less loan', '− ' + sgd(r.loan)],
      ['Downpayment', sgd(r.downpayment)],
      ['Less CPF Ordinary Account', '− ' + sgd(r.cpfOaApplied)],
      ['Less housing grants', '− ' + sgd(r.grantsApplied)],
      ['Cash for downpayment', sgd(r.cashForDownpayment)],
      ['Plus stamp duty in cash', '+ ' + sgd(r.bsdCash)],
    ])}<tr class="pr-tot"><td>Total cash required</td><td>${sgd(r.cashNeeded)}</td></tr></table>

    <p class="pr-foot">Estimates only. BSD tiers are the rates effective 20 February 2023. MSR is capped at
    30% and TDSR at 55% of gross monthly income, assessed at the higher of 4% p.a. or the prevailing rate.
    Grant amounts, LTV limits and lease rules change — confirm with HDB, CPF Board, MAS and IRAS before
    committing. Distance is straight-line, the basis HDB uses for the 4 km proximity condition.
    Not included: option fee, conveyancing and legal fees, HDB resale application fees, valuation,
    agent commission, resale levy and cash-over-valuation.</p>`;
}

function exportPdf() {
  buildPrintReport(compute(readInputs()));
  window.print();
}

/* ===============================================================
   GEOCODING + MAP
   =============================================================== */
let map, markerNew, markerOld, lineLayer, circleLayer;

function initMap() {
  if (typeof L === 'undefined') return;
  map = L.map('map', { scrollWheelZoom: false }).setView([1.3521, 103.8198], 11);
  L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
    minZoom: 11, maxZoom: 18,
    attribution: '&copy; OneMap | Map data &copy; <a href="https://www.sla.gov.sg" target="_blank">SLA</a>',
  }).addTo(map);
}

async function geocode(postal) {
  const url = 'https://www.onemap.gov.sg/api/common/elastic/search'
    + `?searchVal=${encodeURIComponent(postal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OneMap returned ${res.status}`);
  const data = await res.json();
  const hit = (data.results || []).find(x => x.LATITUDE && x.LONGITUDE);
  if (!hit) {
    /* OneMap returns an advisory `error` alongside valid results when
       unauthenticated. Only surface it when it actually cost us the result. */
    if (data.error) throw new Error(`OneMap: ${data.error}`);
    throw new Error(`No address found for postal code ${postal}`);
  }
  return { lat: +hit.LATITUDE, lng: +hit.LONGITUDE, address: hit.ADDRESS || hit.SEARCHVAL };
}

/* Great-circle distance — the straight-line basis HDB uses for the 4 km rule. */
function haversineKm(a, b) {
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function pin(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  });
}

async function measure() {
  const pNew = $('postalNew').value.trim();
  const pOld = $('postalOld').value.trim();
  const status = $('geoStatus');
  status.className = 'geostatus';

  if (!/^\d{6}$/.test(pNew) || !/^\d{6}$/.test(pOld)) {
    status.className = 'geostatus err';
    status.textContent = 'Both postal codes must be 6 digits.';
    return;
  }

  $('measureBtn').disabled = true;
  status.textContent = 'Looking up addresses…';

  try {
    const [a, b] = await Promise.all([geocode(pNew), geocode(pOld)]);
    const km = haversineKm(a, b);
    proximity = { distanceKm: km, eligible: km < 4 };

    $('distValue').textContent = km.toFixed(2);
    $('addrNew').textContent = a.address;
    $('addrOld').textContent = b.address;

    const v = $('distVerdict');
    const amt = moneyValue('grantProx');
    v.className = 'verdict ' + (proximity.eligible ? 'yes' : 'no');
    v.textContent = proximity.eligible
      ? `Within 4 km — ${sgd(amt)} Proximity Housing Grant applies.`
      : 'Further than 4 km — no Proximity Housing Grant.';
    $('distanceResult').hidden = false;

    if (map) {
      [markerNew, markerOld, lineLayer, circleLayer].forEach(l => l && map.removeLayer(l));
      markerNew = L.marker([a.lat, a.lng], { icon: pin('#1f6feb') }).addTo(map).bindPopup(`<b>New flat</b><br>${a.address}`);
      markerOld = L.marker([b.lat, b.lng], { icon: pin('#d1495b') }).addTo(map).bindPopup(`<b>Current flat</b><br>${b.address}`);
      lineLayer = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: proximity.eligible ? '#0f7b45' : '#d1495b', weight: 3, dashArray: '6 6',
      }).addTo(map).bindTooltip(`${km.toFixed(2)} km`, { permanent: true, direction: 'center', className: 'distlabel' });
      circleLayer = L.circle([a.lat, a.lng], {
        radius: 4000, color: '#1f6feb', weight: 1, fillColor: '#1f6feb', fillOpacity: 0.07,
      }).addTo(map);
      map.fitBounds(circleLayer.getBounds().extend(L.latLngBounds([[a.lat, a.lng], [b.lat, b.lng]])), { padding: [30, 30] });
    }

    status.textContent = '';
    recalc();
  } catch (err) {
    status.className = 'geostatus err';
    status.textContent = err.message || 'Lookup failed. Check your connection and try again.';
    proximity = { distanceKm: null, eligible: false };
    $('distanceResult').hidden = true;
    recalc();
  } finally {
    $('measureBtn').disabled = false;
  }
}

/* ===============================================================
   WIRING
   =============================================================== */
function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  setMoney('grant4', p.g4);
  setMoney('grant5', p.g5);
  setMoney('grantProx', p.prox);
  $('presetHint').textContent = p.hint;
  recalc();
}

function syncLoanMode() {
  const mode = document.querySelector('input[name="loanMode"]:checked').value;
  $('ltvBlock').hidden = mode !== 'ltv';
  $('manualBlock').hidden = mode !== 'manual';
  recalc();
}

document.addEventListener('DOMContentLoaded', () => {
  const lu = $('lastUpdated');
  const d = new Date(LAST_UPDATED + 'T00:00:00');
  lu.dateTime = LAST_UPDATED;
  lu.textContent = d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });

  $('topYear').min = CURRENT_YEAR - LEASE_TOTAL_YEARS;
  $('topYear').max = CURRENT_YEAR;
  $('stressRate').placeholder = STRESS_RATE_FLOOR;

  initMap();
  $('presetHint').textContent = PRESETS.custom.hint;

  $('calc').addEventListener('input', recalc);
  $('calc').addEventListener('change', recalc);
  $('calc').addEventListener('submit', (e) => e.preventDefault());

  document.querySelectorAll('input[name="loanMode"]').forEach(el =>
    el.addEventListener('change', syncLoanMode));
  MONEY_FIELDS.forEach(id => {
    const el = $(id);
    formatMoneyField(el);
    el.addEventListener('input', () => formatMoneyField(el));
    el.addEventListener('blur', () => { if (!el.value) el.value = '0'; recalc(); });
  });

  $('pdfBtn').addEventListener('click', exportPdf);
  window.addEventListener('beforeprint', () => buildPrintReport(compute(readInputs())));

  $('ltv').addEventListener('input', () => { ltvAuto = false; });
  $('ltvAutoBtn').addEventListener('click', () => { ltvAuto = true; recalc(); });

  $('grantPreset').addEventListener('change', (e) => applyPreset(e.target.value));
  $('measureBtn').addEventListener('click', measure);
  [$('postalNew'), $('postalOld')].forEach(el =>
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); measure(); } }));

  recalc();
});
