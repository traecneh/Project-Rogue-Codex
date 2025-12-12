function initializeWeaponSpecialtyReferences() {
  const containers = document.querySelectorAll("[data-weapon-specialty]");
  if (!containers.length) return;

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const createLineItem = (label, value) => {
    if (value === undefined || value === null || value === "") return null;
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    li.appendChild(strong);
    li.appendChild(document.createTextNode(String(value)));
    return li;
  };

  const renderForContainer = (container, weapons) => {
    container.innerHTML = "";
    if (!weapons.length) {
      const empty = document.createElement("p");
      empty.className = "nav-search-empty";
      empty.textContent = "No matching weapons yet.";
      container.appendChild(empty);
      return;
    }
    weapons.forEach((weapon) => {
      const card = document.createElement("section");
      card.className = "stat-card";

      const title = document.createElement("h3");
      title.textContent = weapon.name || weapon.id || "Weapon";
      card.appendChild(title);

      const list = document.createElement("ul");
      const entries = [
        createLineItem("DPS", weapon.dps),
        createLineItem("Speed", weapon.attackSpeed ? `${weapon.attackSpeed} ms` : weapon.attackSpeed),
        createLineItem("Level", weapon.level),
        createLineItem("Type", weapon.type),
        createLineItem("Element", weapon.element),
        createLineItem("Perk", weapon.perk),
      ].filter(Boolean);

      entries.forEach((item) => list.appendChild(item));
      card.appendChild(list);
      container.appendChild(card);
    });
  };

  loadWeaponData()
    .then((data) => {
      containers.forEach((container) => {
        const targetSpec = normalize(container.getAttribute("data-weapon-specialty"));
        if (!targetSpec) return;
        const matches = data.filter((weapon) => normalize(weapon.specialty) === targetSpec);
        renderForContainer(container, matches);
      });
    })
    .catch(() => {
      containers.forEach((container) => {
        container.innerHTML = "";
        const error = document.createElement("p");
        error.className = "nav-search-empty";
        error.textContent = "Unable to load weapons.";
        container.appendChild(error);
      });
    });
}

