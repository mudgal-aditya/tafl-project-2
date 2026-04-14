
function parseGrammar(input) {
  let rules = {};
  input.split("\n").forEach(line => {
    if (!line.trim()) return;
    let parts = line.split("->").map(s => s.trim());
    if (parts.length < 2) return;
    rules[parts[0]] = parts[1].split("|").map(r => r.trim());
  });
  return rules;
}

function printGrammar(g) {
  let out = "";
  for (let k in g)
    if (g[k] && g[k].length > 0)
      out += k + "  \u2192  " + g[k].join("  |  ") + "\n";
  return out;
}

function removeUseless(grammar) {
  let generating = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (let A in grammar) {
      for (let prod of grammar[A]) {
        let valid = true;
        for (let c of prod) { if (grammar[c] && !generating.has(c)) { valid = false; break; } }
        if (valid && !generating.has(A)) { generating.add(A); changed = true; }
      }
    }
  }
  let genF = {};
  for (let A in grammar)
    if (generating.has(A))
      genF[A] = grammar[A].filter(p => [...p].every(c => !grammar[c] || generating.has(c)));

  let reachable = new Set(["S"]), queue = ["S"];
  while (queue.length) {
    let cur = queue.shift();
    if (!genF[cur]) continue;
    for (let prod of genF[cur])
      for (let c of prod)
        if (genF[c] && !reachable.has(c)) { reachable.add(c); queue.push(c); }
  }
  let final = {};
  for (let A of reachable) if (genF[A]) final[A] = genF[A];
  return final;
}

function removeNull(grammar) {
  let nullable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (let A in grammar)
      for (let prod of grammar[A]) {
        let isNull = prod === "\u03b5" || [...prod].every(c => nullable.has(c));
        if (isNull && !nullable.has(A)) { nullable.add(A); changed = true; }
      }
  }
  let newG = {};
  for (let A in grammar) {
    newG[A] = new Set();
    for (let prod of grammar[A]) {
      if (prod === "\u03b5") continue;
      generateCombinations(prod, nullable).forEach(c => newG[A].add(c || "\u03b5"));
    }
  }
  for (let A in newG) newG[A] = [...newG[A]];
  return newG;
}

function generateCombinations(prod, nullable) {
  let results = [""];
  for (let c of prod) {
    let temp = [];
    for (let r of results) {
      temp.push(r + c);
      if (nullable.has(c)) temp.push(r);
    }
    results = temp;
  }
  return [...new Set(results)];
}

function removeUnit(grammar) {
  let unitPairs = {};
  for (let A in grammar) unitPairs[A] = new Set([A]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let A in grammar)
      for (let prod of grammar[A])
        if (grammar[prod])
          for (let x of unitPairs[prod])
            if (!unitPairs[A].has(x)) { unitPairs[A].add(x); changed = true; }
  }
  let newG = {};
  for (let A in grammar) {
    newG[A] = new Set();
    for (let B of unitPairs[A])
      for (let prod of grammar[B])
        if (!grammar[prod]) newG[A].add(prod);
  }
  for (let A in newG) newG[A] = [...newG[A]];
  return newG;
}

/* ═══════════════════════════════════════════
   ANALYSIS HELPERS
   ═══════════════════════════════════════════ */
function findNullable(g) {
  let nullable = new Set(), changed = true;
  while (changed) {
    changed = false;
    for (let A in g)
      for (let prod of g[A]) {
        let isNull = prod === "\u03b5" || [...prod].every(c => nullable.has(c));
        if (isNull && !nullable.has(A)) { nullable.add(A); changed = true; }
      }
  }
  return nullable;
}

function findNonGenerating(g) {
  let generating = new Set(), changed = true;
  while (changed) {
    changed = false;
    for (let A in g)
      for (let prod of g[A]) {
        let valid = true;
        for (let c of prod) { if (g[c] && !generating.has(c)) { valid = false; break; } }
        if (valid && !generating.has(A)) { generating.add(A); changed = true; }
      }
  }
  return Object.keys(g).filter(k => !generating.has(k));
}

function findUnreachable(g) {
  // first filter to generating only
  let generating = new Set(), changed = true;
  while (changed) {
    changed = false;
    for (let A in g)
      for (let prod of g[A]) {
        let valid = true;
        for (let c of prod) { if (g[c] && !generating.has(c)) { valid = false; break; } }
        if (valid && !generating.has(A)) { generating.add(A); changed = true; }
      }
  }
  let genF = {};
  for (let A in g)
    if (generating.has(A))
      genF[A] = g[A].filter(p => [...p].every(c => !g[c] || generating.has(c)));

  let reachable = new Set(["S"]), queue = ["S"];
  while (queue.length) {
    let cur = queue.shift();
    if (!genF[cur]) continue;
    for (let prod of genF[cur])
      for (let c of prod)
        if (genF[c] && !reachable.has(c)) { reachable.add(c); queue.push(c); }
  }
  return Object.keys(genF).filter(k => !reachable.has(k));
}

function findUnitProductions(g) {
  let units = [];
  for (let A in g)
    for (let prod of g[A])
      if (g[prod]) units.push({ from: A, to: prod });
  return units;
}

/* ═══════════════════════════════════════════
   TRACE HTML BUILDERS
   ═══════════════════════════════════════════ */
function chip(text, cls) {
  return `<span class="chip ${cls}">${text}</span>`;
}

function findingRow(icon, html, extra) {
  return `<div class="finding${extra ? ' ' + extra : ''}">
    <span class="fi-icon">${icon}</span>
    <div class="fi-text">${html}</div>
  </div>`;
}

function buildTrace_Step1(g0, g1) {
  let nonGen = findNonGenerating(g0);
  let unreachable = findUnreachable(g0);
  let removed = [...new Set([...nonGen, ...unreachable])];

  // All vars with generating status
  let generating = new Set(), changed = true;
  while (changed) {
    changed = false;
    for (let A in g0)
      for (let prod of g0[A]) {
        let valid = true;
        for (let c of prod) { if (g0[c] && !generating.has(c)) { valid = false; break; } }
        if (valid && !generating.has(A)) { generating.add(A); changed = true; }
      }
  }

  let findings = [];

  // Pass 1
  let genChips = Object.keys(g0).map(v =>
    chip(v + (generating.has(v) ? ' ✓' : ' ✗'), generating.has(v) ? 'kept' : 'removed')
  ).join('');
  findings.push(findingRow('1a',
    `<strong>Pass 1 — Generating variables</strong><br>
     A variable generates if it can eventually produce only terminals.<br>
     <div class="fi-chips">${genChips}</div>`
  ));

  if (nonGen.length === 0)
    findings.push(findingRow('✓', 'All variables are generating — none removed in pass 1.', 'success'));
  else
    findings.push(findingRow('✗',
      `<strong>Non-generating removed:</strong><div class="fi-chips">${nonGen.map(v=>chip(v,'removed')).join('')}</div>`
    ));

  // Pass 2
  // reachable after gen-filter
  let genF = {};
  for (let A in g0)
    if (generating.has(A))
      genF[A] = g0[A].filter(p => [...p].every(c => !g0[c] || generating.has(c)));
  let reachable = new Set(["S"]), q2 = ["S"];
  while (q2.length) {
    let cur = q2.shift();
    if (!genF[cur]) continue;
    for (let prod of genF[cur])
      for (let c of prod)
        if (genF[c] && !reachable.has(c)) { reachable.add(c); q2.push(c); }
  }
  let reachChips = Object.keys(genF).map(v =>
    chip(v + (reachable.has(v) ? ' ✓' : ' ✗'), reachable.has(v) ? 'kept' : 'removed')
  ).join('');
  findings.push(findingRow('1b',
    `<strong>Pass 2 — Reachable variables from S</strong><br>
     BFS from S through all productions.<br>
     <div class="fi-chips">${reachChips}</div>`
  ));

  if (unreachable.length === 0)
    findings.push(findingRow('✓', 'All remaining variables are reachable — none removed in pass 2.', 'success'));
  else
    findings.push(findingRow('✗',
      `<strong>Unreachable removed:</strong><div class="fi-chips">${unreachable.map(v=>chip(v,'removed')).join('')}</div>`
    ));

  if (removed.length === 0)
    findings.push(findingRow('✓', '<strong>No changes.</strong> Grammar already has no useless symbols.', 'success'));
  else
    findings.push(findingRow('→',
      `<strong>Total symbols removed:</strong><div class="fi-chips">${removed.map(v=>chip(v,'removed')).join('')}</div>`
    ));

  return buildTraceCard('s1', '1', 'Step 1 — Remove Useless Symbols',
    `${removed.length} symbol(s) removed`, g0, g1, findings);
}

function buildTrace_Step2(g1, g2) {
  let nullable = findNullable(g1);
  let findings = [];

  if (nullable.size === 0) {
    findings.push(findingRow('✓',
      '<strong>No nullable variables found.</strong> Grammar has no ε-productions — unchanged.', 'success'));
  } else {
    findings.push(findingRow('ε',
      `<strong>Nullable variables identified</strong><br>
       These can derive ε directly or transitively.<br>
       <div class="fi-chips">${[...nullable].map(v=>chip(v+' ⟹ ε','nullable')).join('')}</div>`
    ));

    // Per-rule expansion
    let expRows = '';
    for (let A in g1) {
      g1[A].forEach(prod => {
        if (prod === '\u03b5') return;
        if (![...prod].some(c => nullable.has(c))) return;
        let combos = generateCombinations(prod, nullable).filter(c => c !== '');
        expRows += `<div class="expand-row">${A} \u2192 ${prod}<span class="expand-arrow">expands to</span>${combos.join(',  ')}</div>`;
      });
    }
    if (expRows)
      findings.push(findingRow('↓',
        `<strong>Rules rewritten — nullable variables dropped in all combinations:</strong>
         <div style="margin-top:8px;">${expRows}</div>`
      ));

    findings.push(findingRow('✗',
      `<strong>All A \u2192 \u03b5 rules removed</strong> after generating new combinations.`
    ));
  }

  return buildTraceCard('s2', '2', 'Step 2 — Remove Null Productions',
    `${nullable.size} nullable variable(s)`, g1, g2, findings);
}

function buildTrace_Step3(g2, g3) {
  let units = findUnitProductions(g2);

  // unit pair closure
  let unitPairs = {};
  for (let A in g2) unitPairs[A] = new Set([A]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let A in g2)
      for (let prod of g2[A])
        if (g2[prod])
          for (let x of unitPairs[prod])
            if (!unitPairs[A].has(x)) { unitPairs[A].add(x); changed = true; }
  }

  let findings = [];

  if (units.length === 0) {
    findings.push(findingRow('✓',
      '<strong>No unit productions found.</strong> Grammar already has no A \u2192 B rules — unchanged.', 'success'));
  } else {
    findings.push(findingRow('→',
      `<strong>Unit productions identified</strong><br>
       Rules of the form A \u2192 B where B is a single variable.<br>
       <div class="fi-chips">${units.map(u=>chip(u.from+' \u2192 '+u.to,'new')).join('')}</div>`
    ));

    let closureChips = Object.entries(unitPairs)
      .filter(([,set]) => set.size > 1)
      .map(([A,set]) => chip('UNIT('+A+') = {'+[...set].join(', ')+'}','neutral'))
      .join('');
    if (closureChips)
      findings.push(findingRow('⊇',
        `<strong>Unit-pair closure computed</strong><br>
         If A \u21D2* B via unit rules, non-unit productions of B are added to A.<br>
         <div class="fi-chips">${closureChips}</div>`
      ));

    let substRows = '';
    for (let A in g2) {
      unitPairs[A].forEach(B => {
        if (B === A) return;
        let added = (g2[B] || []).filter(p => !g2[p]);
        if (added.length > 0)
          substRows += `<div class="expand-row">${A} absorbs <span style="font-weight:600;">${B}</span><span class="expand-arrow">\u2192</span>${added.join(',  ')}</div>`;
      });
    }
    if (substRows)
      findings.push(findingRow('↓',
        `<strong>Productions substituted in:</strong><div style="margin-top:8px;">${substRows}</div>`
      ));

    findings.push(findingRow('✗', '<strong>All unit productions removed</strong> after substitution.'));
  }

  // Final summary
  let finalVars = Object.keys(g3).length;
  findings.push(findingRow('✓',
    `<strong>Simplification complete.</strong> Grammar now has no useless symbols, no null productions, and no unit productions. Final grammar has <strong>${finalVars} variable(s)</strong>.`,
    'success'
  ));

  return buildTraceCard('s3', '3', 'Step 3 — Remove Unit Productions',
    `${units.length} unit production(s) removed`, g2, g3, findings);
}

function buildTraceCard(sClass, badge, title, meta, gBefore, gAfter, findings) {
  let findingsHtml = findings.map(f => f).join('');
  return `
  <div class="trace-block" id="trace-${sClass}">
    <div class="tb-header ${sClass}">
      <div class="tb-badge ${sClass}">${badge}</div>
      <div class="tb-title">${title}</div>
      <div class="tb-meta">${meta}</div>
    </div>
    <div class="tb-body">
      <div class="tb-findings">${findingsHtml}</div>
      <div class="tb-div"></div>
      <div class="diff-row">
        <div class="diff-box">
          <div class="diff-head before">Before step ${badge}</div>
          <div class="diff-body">${printGrammar(gBefore)||'(empty)'}</div>
        </div>
        <div class="diff-box">
          <div class="diff-head after">After step ${badge}</div>
          <div class="diff-body">${printGrammar(gAfter)||'(empty)'}</div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════
   ANIMATION HELPERS
   ═══════════════════════════════════════════ */
function animateTraceBlock(blockEl) {
  // slight delay then reveal the card
  setTimeout(() => {
    blockEl.classList.add('revealed');
    // stagger the finding rows inside
    let rows = blockEl.querySelectorAll('.finding');
    rows.forEach((row, i) => {
      setTimeout(() => row.classList.add('shown'), 120 + i * 80);
    });
  }, 60);
}

function animateOutput(text) {
  let pre = document.getElementById('output');
  pre.classList.remove('fade-in');
  // force reflow
  void pre.offsetWidth;
  pre.classList.add('fade-in');
}

/* ═══════════════════════════════════════════
   MAIN STEP RUNNER
   ═══════════════════════════════════════════ */
const stepLabels = {
  1: 'Useless symbols removed',
  2: 'Null productions removed',
  3: 'Unit productions removed',
  all: 'Fully simplified'
};

function runStep(n) {
  // Button state
  [1,2,3].forEach(i => document.getElementById('btn'+i).classList.remove('active'));
  document.getElementById('btn'+n).classList.add('active');

  let g = parseGrammar(document.getElementById('grammarInput').value);
  let g1 = removeUseless(g);
  let g2 = removeNull(g1);
  let g3 = removeUnit(g2);

  // Output
  let result = n===1 ? g1 : n===2 ? g2 : g3;
  let out = printGrammar(result);
  let pre = document.getElementById('output');
  let tag = document.getElementById('outputTag');
  pre.innerHTML = out ? out : '<span class="placeholder">No productions remain after this step.</span>';
  tag.textContent = stepLabels[n];
  tag.className = 'output-tag done';
  animateOutput();

  // Build trace — only up to the selected step
  let traceHTML = '';
  if (n >= 1) traceHTML += buildTrace_Step1(g, g1);
  if (n >= 2) traceHTML += buildTrace_Step2(g1, g2);
  if (n >= 3) traceHTML += buildTrace_Step3(g2, g3);

  let panel = document.getElementById('tracePanel');
  panel.innerHTML = traceHTML;

  // Animate each block in sequence
  let blocks = panel.querySelectorAll('.trace-block');
  blocks.forEach((block, i) => {
    setTimeout(() => animateTraceBlock(block), i * 180);
  });
}

function runAllSteps() {
  [1,2,3].forEach(i => document.getElementById('btn'+i).classList.remove('active'));

  let g = parseGrammar(document.getElementById('grammarInput').value);
  let g1 = removeUseless(g);
  let g2 = removeNull(g1);
  let g3 = removeUnit(g2);

  let out = printGrammar(g3);
  let pre = document.getElementById('output');
  let tag = document.getElementById('outputTag');
  pre.innerHTML = out ? out : '<span class="placeholder">No productions remain.</span>';
  tag.textContent = stepLabels.all;
  tag.className = 'output-tag done';
  animateOutput();

  let panel = document.getElementById('tracePanel');
  panel.innerHTML =
    buildTrace_Step1(g, g1) +
    buildTrace_Step2(g1, g2) +
    buildTrace_Step3(g2, g3);

  let blocks = panel.querySelectorAll('.trace-block');
  blocks.forEach((block, i) => {
    setTimeout(() => animateTraceBlock(block), i * 200);
  });
}

function clearAll() {
  [1,2,3].forEach(i => document.getElementById('btn'+i).classList.remove('active'));
  document.getElementById('output').innerHTML = '<span class="placeholder">Select a step above, or click "Run All Steps".</span>';
  document.getElementById('outputTag').textContent = 'waiting';
  document.getElementById('outputTag').className = 'output-tag';
  document.getElementById('tracePanel').innerHTML = '';
}

/* ═══════════════════════════════════════════
   EXAMPLES
   ═══════════════════════════════════════════ */
const examples = [
  "S -> AB | a\nA -> aA | ε\nB -> b",
  "S -> A | b\nA -> B | a\nB -> ab",
  "S -> AB | a\nA -> aA | ε\nB -> b\nC -> D\nD -> ε\nE -> aE",
  "S -> AB | C\nA -> aA | ε\nB -> bB | ε\nC -> c\nD -> d"
];

function loadExample(i) {
  document.getElementById('grammarInput').value = examples[i];
  clearAll();
}

/* ═══════════════════════════════════════════
   TAB NAV
   ═══════════════════════════════════════════ */
function showTab(name, el) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (el) el.classList.add('active');
}
