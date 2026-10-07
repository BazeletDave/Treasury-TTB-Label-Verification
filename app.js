const REQUIRED_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const $ = (id) => document.getElementById(id);

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);

  if (a === b) return 1;
  if (!a || !b) return 0;

  const matrix = Array.from(
    { length: b.length + 1 },
    () => []
  );

  for (let i = 0; i <= b.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }

  const distance = matrix[b.length][a.length];

  return (
    1 -
    distance / Math.max(a.length, b.length)
  );
}

function containsNormalized(haystack, needle) {
  return normalize(haystack).includes(
    normalize(needle)
  );
}

function checkField(
  name,
  expected,
  labelText,
  options = {}
) {
  if (!expected.trim()) {
    return {
      name,
      status: "review",
      detail: "No expected value provided."
    };
  }

  if (
    containsNormalized(
      labelText,
      expected
    )
  ) {
    return {
      name,
      status: "pass",
      detail: `Matched: ${expected}`
    };
  }

  const lines = labelText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let best = 0;
  let bestLine = "";

  for (const line of lines) {
    const score = similarity(
      expected,
      line
    );

    if (score > best) {
      best = score;
      bestLine = line;
    }
  }

  const threshold =
    options.reviewThreshold ?? 0.78;

  if (best >= threshold) {
    return {
      name,
      status: "review",
      detail:
        `Possible near match: "${bestLine}" ` +
        `(${Math.round(best * 100)}% similarity). ` +
        `Human review recommended.`
    };
  }

  return {
    name,
    status: "fail",
    detail:
      `Expected value not found: ${expected}`
  };
}

function checkWarning(labelText) {
  const normalizedLabel =
    normalize(labelText);

  const normalizedWarning =
    normalize(REQUIRED_WARNING);

  if (
    normalizedLabel.includes(
      normalizedWarning
    )
  ) {
    return {
      name: "Government warning",
      status: "pass",
      detail:
        "Required warning text found."
    };
  }

  const hasHeading =
    /GOVERNMENT WARNING:/i.test(
      labelText
    );

  const hasPregnancy =
    /pregnan/i.test(
      labelText
    );

  const hasDriving =
    /drive a car|operate machinery/i.test(
      labelText
    );

  if (
    hasHeading &&
    hasPregnancy &&
    hasDriving
  ) {
    return {
      name: "Government warning",
      status: "review",
      detail:
        "Warning appears substantially present, but exact wording or formatting should be reviewed."
    };
  }

  return {
    name: "Government warning",
    status: "fail",
    detail:
      "Required government warning is missing or materially incomplete."
  };
}

function renderResults(items, elapsed) {
  const results =
    $("results");

  results.innerHTML = "";

  items.forEach((item) => {
    const row =
      document.createElement("div");

    row.className =
      "result-row";

    row.innerHTML = `
      <div class="result-label">
        ${item.name}
      </div>

      <div class="result-detail">
        ${item.detail}
      </div>

      <div class="result-status ${item.status}">
        ${
          item.status === "pass"
            ? "Match"
            : item.status === "review"
            ? "Review"
            : "Mismatch"
        }
      </div>
    `;

    results.appendChild(row);
  });

  const hasFail =
    items.some(
      (item) =>
        item.status === "fail"
    );

  const hasReview =
    items.some(
      (item) =>
        item.status === "review"
    );

  let overall =
    "Match";

  let cssClass =
    "pass";

  let summary =
    "All core checks passed.";

  if (hasFail) {
    overall =
      "Mismatch";

    cssClass =
      "fail";

    summary =
      "One or more material discrepancies require correction or agent review.";
  } else if (hasReview) {
    overall =
      "Review Required";

    cssClass =
      "review";

    summary =
      "No clear material failure, but at least one field needs human judgment.";
  }

  $("overall").textContent =
    overall;

  $("overall").className =
    `overall ${cssClass}`;

  $("summary").textContent =
    summary;

  $("runtime").textContent =
    `Completed in ${elapsed.toFixed(1)} ms`;
}

function verify() {
  const start =
    performance.now();

  const labelText =
    $("labelText").value;

  const checks = [
    checkField(
      "Brand name",
      $("brand").value,
      labelText,
      {
        reviewThreshold: 0.8
      }
    ),

    checkField(
      "Class / type",
      $("type").value,
      labelText,
      {
        reviewThreshold: 0.8
      }
    ),

    checkField(
      "Alcohol content",
      $("abv").value,
      labelText,
      {
        reviewThreshold: 0.72
      }
    ),

    checkField(
      "Net contents",
      $("net").value,
      labelText,
      {
        reviewThreshold: 0.72
      }
    ),

    checkField(
      "Producer / bottler",
      $("producer").value,
      labelText,
      {
        reviewThreshold: 0.7
      }
    )
  ];

  if (
    $("origin").value.trim()
  ) {
    checks.push(
      checkField(
        "Country of origin",
        $("origin").value,
        labelText,
        {
          reviewThreshold: 0.78
        }
      )
    );
  }

  checks.push(
    checkWarning(
      labelText
    )
  );

  const end =
    performance.now();

  renderResults(
    checks,
    end - start
  );
}

$("verifyBtn").addEventListener(
  "click",
  verify
);

$("loadMismatch").addEventListener(
  "click",
  () => {
    $("labelText").value = `Old Tom Distillery
Kentucky Straight Bourbon Whiskey
40% Alc./Vol. (80 Proof)
1 L
Old Tom Distillery, Louisville, KY
Government Warning: Consumption of alcoholic beverages may cause health problems.`;

    verify();
  }
);

$("resetBtn").addEventListener(
  "click",
  () => {
    location.reload();
  }
);

$("imageUpload").addEventListener(
  "change",
  (event) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      $("preview").src =
        reader.result;

      $("preview").hidden =
        false;
    };

    reader.readAsDataURL(
      file
    );
  }
);
