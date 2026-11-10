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

  const loadWeaponReferences = async () => {
    const utils = window.RogueCodexUtils;
    const [rows, allowlists] = await Promise.all([
      utils.fetchJsonCached("pages/items/weapons_data05.json"), utils.loadAllowlists(),
    ]);
    const blocked = utils.buildNameSet(allowlists.weapons?.block);
    const blockedIds = new Set(allowlists.weapons?.blockIds || []);
    return (Array.isArray(rows) ? rows : [])
      .filter(row => !utils.isRecordHidden(row,blocked) && !blockedIds.has(String(row.id)))
      .map(row => {
        const fields = row.fields || {};
        const min = Number(fields.min_damage ?? row.minDamage);
        const max = Number(fields.max_damage ?? row.maxDamage);
        const speed = Number(fields.attack_speed ?? row.attackSpeed);
        return {
          id:row.id, name:row.name || row.Name,
          specialty:fields.specialty ? fields.specialty_label || String(fields.specialty) : row.specialty,
          dps:Number.isFinite(min+max+speed) && speed > 0 ? Number(((min+max)/2*1000/speed).toFixed(2)) : null,
          attackSpeed:speed, level:fields.level_requirement ?? row.level,
          type:fields.subtype_label || row.type,
          element:fields.element_label || row.element,
          perk:fields.perk_label || row.perk,
        };
      });
  };

  loadWeaponReferences()
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

