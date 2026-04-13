function parseGrammar(input) {
  let rules = {};
  input.split("\n").forEach(line => {
    if (!line.trim()) return;
    let parts = line.split("->").map(s => s.trim());
    if (parts.length < 2) return;

    let left = parts[0];
    let right = parts[1];
    rules[left] = right.split("|").map(r => r.trim());
  });
  return rules;
}

function printGrammar(g) {
  let out = "";
  for (let k in g) {
    if (g[k] && g[k].length > 0) {
      out += k + "  →  " + g[k].join("  |  ") + "\n";
    }
  }
  return out;
}

/* STEP 1: REMOVE USELESS SYMBOLS (GENERATING + REACHABLE) */
function removeUseless(grammar) {
  // ---- GENERATING ----
  let generating = new Set();
  let changed = true;

  while (changed) {
    changed = false;
    for (let A in grammar) {
      for (let prod of grammar[A]) {
        let valid = true;
        for (let c of prod) {
          if (grammar[c] && !generating.has(c)) {
            valid = false;
            break;
          }
        }
        if (valid && !generating.has(A)) {
          generating.add(A);
          changed = true;
        }
      }
    }
  }

  let genFiltered = {};
  for (let A in grammar) {
    if (generating.has(A)) {
      genFiltered[A] = grammar[A].filter(p =>
        [...p].every(c => !grammar[c] || generating.has(c))
      );
    }
  }

  // ---- REACHABLE ----
  let reachable = new Set(["S"]);
  let queue = ["S"];

  while (queue.length) {
    let current = queue.shift();
    if (!genFiltered[current]) continue;

    for (let prod of genFiltered[current]) {
      for (let c of prod) {
        if (genFiltered[c] && !reachable.has(c)) {
          reachable.add(c);
          queue.push(c);
        }
      }
    }
  }

  let finalGrammar = {};
  for (let A of reachable) {
    if (genFiltered[A]) {
      finalGrammar[A] = genFiltered[A];
    }
  }

  return finalGrammar;
}

/* STEP 2: REMOVE NULL PRODUCTIONS */
function removeNull(grammar) {
  let nullable = new Set();
  let changed = true;

  while (changed) {
    changed = false;
    for (let A in grammar) {
      for (let prod of grammar[A]) {
        let isNull =
          prod === "ε" ||
          [...prod].every(c => nullable.has(c));

        if (isNull && !nullable.has(A)) {
          nullable.add(A);
          changed = true;
        }
      }
    }
  }

  let newGrammar = {};
  for (let A in grammar) {
    newGrammar[A] = new Set();

    for (let prod of grammar[A]) {
      if (prod === "ε") continue;

      let combos = generateCombinations(prod, nullable);
      combos.forEach(c => newGrammar[A].add(c || "ε"));
    }
  }

  for (let A in newGrammar) {
    newGrammar[A] = [...newGrammar[A]];
  }

  return newGrammar;
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

/* STEP 3: REMOVE UNIT PRODUCTIONS */
function removeUnit(grammar) {
  let unitPairs = {};

  for (let A in grammar) {
    unitPairs[A] = new Set([A]);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let A in grammar) {
      for (let prod of grammar[A]) {
        if (grammar[prod]) {
          for (let x of unitPairs[prod]) {
            if (!unitPairs[A].has(x)) {
              unitPairs[A].add(x);
              changed = true;
            }
          }
        }
      }
    }
  }

  let newGrammar = {};
  for (let A in grammar) {
    newGrammar[A] = new Set();

    for (let B of unitPairs[A]) {
      for (let prod of grammar[B]) {
        if (!grammar[prod]) {
          newGrammar[A].add(prod);
        }
      }
    }
  }

  for (let A in newGrammar) {
    newGrammar[A] = [...newGrammar[A]];
  }

  return newGrammar;
}

/* FINAL STEP EXECUTION (SEQUENTIAL — FIXED) */
function runStep(n) {
  [1, 2, 3].forEach(i =>
    document.getElementById("btn" + i).classList.remove("active")
  );
  document.getElementById("btn" + n).classList.add("active");

  let g = parseGrammar(document.getElementById("grammarInput").value);

  let result;

  if (n === 1) {
    result = removeUseless(g);
  } 
  else if (n === 2) {
    let g1 = removeUseless(g);
    result = removeNull(g1);
  } 
  else {
    let g1 = removeUseless(g);
    let g2 = removeNull(g1);
    result = removeUnit(g2);
  }

  let out = printGrammar(result);

  let pre = document.getElementById("output");
  let tag = document.getElementById("outputTag");

  pre.innerHTML = out
    ? out
    : '<span class="placeholder">No productions remain after this step.</span>';

  const stepNames = {
    1: "Useless symbols removed",
    2: "Null productions removed",
    3: "Unit productions removed"
  };

  tag.textContent = stepNames[n];
  tag.className = "output-tag done";
}