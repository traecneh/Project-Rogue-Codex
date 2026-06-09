const ANTI_ZERG_REDUCTION_TABLE = Object.freeze({
  1: [
    { min: 2, max: 2, value: "20%" },
    { min: 3, max: 14, value: "30%" },
  ],
  2: [
    { min: 3, max: 3, value: "0%" },
    { min: 4, max: 14, value: "30%" },
  ],
  3: [
    { min: 4, max: 4, value: "0%" },
    { min: 5, max: 5, value: "25%" },
    { min: 6, max: 14, value: "30%" },
  ],
  4: [
    { min: 5, max: 5, value: "0%" },
    { min: 6, max: 6, value: "20%" },
    { min: 7, max: 14, value: "30%" },
  ],
  5: [
    { min: 6, max: 6, value: "0%" },
    { min: 7, max: 7, value: "16.67%" },
    { min: 8, max: 8, value: "28.57%" },
    { min: 9, max: 14, value: "30%" },
  ],
  6: [
    { min: 7, max: 7, value: "0%" },
    { min: 8, max: 8, value: "14.29%" },
    { min: 9, max: 9, value: "25%" },
    { min: 10, max: 14, value: "30%" },
  ],
  7: [
    { min: 8, max: 8, value: "0%" },
    { min: 9, max: 9, value: "12.50%" },
    { min: 10, max: 10, value: "22.22%" },
    { min: 11, max: 14, value: "30%" },
  ],
  8: [
    { min: 9, max: 9, value: "0%" },
    { min: 10, max: 10, value: "11.11%" },
    { min: 11, max: 11, value: "20%" },
    { min: 12, max: 12, value: "27.27%" },
    { min: 13, max: 14, value: "30%" },
  ],
  9: [
    { min: 10, max: 10, value: "0%" },
    { min: 11, max: 11, value: "10%" },
    { min: 12, max: 12, value: "18.18%" },
    { min: 13, max: 13, value: "25%" },
    { min: 14, max: 14, value: "30%" },
  ],
  10: [
    { min: 11, max: 11, value: "0%" },
    { min: 12, max: 12, value: "9.09%" },
    { min: 13, max: 13, value: "16.67%" },
    { min: 14, max: 14, value: "23.08%" },
  ],
  11: [
    { min: 12, max: 12, value: "0%" },
    { min: 13, max: 13, value: "8.33%" },
    { min: 14, max: 14, value: "15.38%" },
  ],
  12: [
    { min: 13, max: 13, value: "0%" },
    { min: 14, max: 14, value: "7.69%" },
  ],
  13: [{ min: 14, max: 14, value: "0%" }],
});

function describeAntiZergPlayers(count) {
  return `${count} player${count === 1 ? "" : "s"}`;
}

function evaluateAntiZergMatchup(myGuildSize, enemyGuildSize) {
  const smaller = Math.min(myGuildSize, enemyGuildSize);
  const larger = Math.max(myGuildSize, enemyGuildSize);
  const smallerTeamName =
    myGuildSize === enemyGuildSize ? "Neither guild" : myGuildSize < enemyGuildSize ? "My guild" : "Enemy guild";

  if (larger === smaller) {
    return {
      note: "Both guilds are the same size, so no one receives Anti-Zerg damage reduction.",
      scenario: `Both guilds match at ${describeAntiZergPlayers(myGuildSize)}.`,
      value: "0%",
    };
  }

  const entries = ANTI_ZERG_REDUCTION_TABLE[smaller];
  const match = entries?.find((entry) => larger >= entry.min && larger <= entry.max);
  if (!match) {
    return {
      note: "No guild receives Anti-Zerg here because this matchup is outside the published ranges.",
      scenario: `${smallerTeamName} is smaller (${describeAntiZergPlayers(smaller)}); ${myGuildSize < enemyGuildSize ? "Enemy guild" : "My guild"} is larger (${describeAntiZergPlayers(larger)})`,
      value: "N/A",
    };
  }

  let note;
  if (match.value === "0%") {
    note = `${smallerTeamName} does not qualify for Anti-Zerg because the size gap is too small.`;
  } else if (match.value === "30%") {
    note = `${smallerTeamName} receives the max ${match.value} damage reduction.`;
  } else {
    note = `${smallerTeamName} receives ${match.value} damage reduction in this matchup.`;
  }

  return {
    note,
    scenario: `${smallerTeamName} is smaller (${describeAntiZergPlayers(smaller)}); ${myGuildSize < enemyGuildSize ? "Enemy guild" : "My guild"} is larger (${describeAntiZergPlayers(larger)})`,
    value: match.value,
  };
}

function initAntiZergCalculator(root = document) {
  const smallerInput = root.querySelector("[data-smaller-range]");
  const largerInput = root.querySelector("[data-bigger-range]");
  if (!smallerInput || !largerInput) return;

  const smallerValue = root.querySelector("[data-smaller-value]");
  const largerValue = root.querySelector("[data-bigger-value]");
  const scenarioText = root.querySelector("[data-reduction-scenario]");
  const resultText = root.querySelector("[data-reduction-result]");
  const noteText = root.querySelector("[data-reduction-note]");

  function updateCalculator() {
    const myGuildSize = Number(smallerInput.value);
    const enemyGuildSize = Number(largerInput.value);
    const result = evaluateAntiZergMatchup(myGuildSize, enemyGuildSize);

    smallerValue.textContent = describeAntiZergPlayers(myGuildSize);
    largerValue.textContent = describeAntiZergPlayers(enemyGuildSize);
    scenarioText.textContent = result.scenario;
    resultText.textContent = result.value;
    noteText.textContent = result.note;
  }

  smallerInput.addEventListener("input", updateCalculator);
  largerInput.addEventListener("input", updateCalculator);
  updateCalculator();
}

document.addEventListener("DOMContentLoaded", () => {
  initAntiZergCalculator();
});
