function initializeKeywordLinks() {
  if (!document.body) return;

  const keywordRules = [
    {
      keyword: "Strength",
      href: "pages/stats/strength.html",
      excludedPaths: ["pages/stats/strength.html"],
    },
    {
      keyword: "Dexterity",
      href: "pages/stats/dexterity.html",
      excludedPaths: ["pages/stats/dexterity.html"],
    },
    {
      keyword: "Constitution",
      href: "pages/stats/constitution.html",
      excludedPaths: ["pages/stats/constitution.html"],
    },
    {
      keyword: "Floor Cleanup",
      href: "pages/systems/floor-cleanup.html",
      excludedPaths: ["pages/systems/floor-cleanup.html"],
    },
    {
      keyword: "Creeper",
      href: "pages/systems/floor-cleanup.html",
      excludedPaths: ["pages/systems/floor-cleanup.html"],
    },
    {
      keyword: "Perks",
      href: "pages/systems/perks.html",
      excludedPaths: ["pages/systems/perks.html"],
    },
  ];

  const normalizedRules = keywordRules
    .filter((rule) => rule.keyword)
    .map((rule) => ({
      ...rule,
      keywordPattern: new RegExp(`\\b${escapeRegExp(String(rule.keyword))}\\b`, "gi"),
      excludedPathsLower: (rule.excludedPaths || []).map((excluded) => excluded.toLowerCase()),
    }));

  const currentPath = window.location.pathname.toLowerCase();
  const activeRules = normalizedRules.filter(
    (rule) => !rule.excludedPathsLower.some((excluded) => currentPath.includes(excluded))
  );
  if (!activeRules.length) return;

  const skipTags = new Set([
    "A",
    "SCRIPT",
    "STYLE",
    "CODE",
    "PRE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "BUTTON",
    "SELECT",
    "OPTION",
    "HEAD",
    "TITLE",
  ]);

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const shouldSkipNode = (node) => {
    let parent = node.parentNode;
    while (parent) {
      if (parent.nodeType === Node.ELEMENT_NODE && skipTags.has(parent.tagName)) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  };

  const linkifyRule = (rule) => {
    const pattern = rule.keywordPattern;
    if (!pattern) return;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node || !node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          if (shouldSkipNode(node)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

    const textNodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    textNodes.forEach((node) => {
      const text = node.nodeValue;
      if (!text || !node.parentNode) return;
      const regex = pattern;
      regex.lastIndex = 0;
      let match;
      let lastIndex = 0;
      let replaced = false;
      const fragment = document.createDocumentFragment();

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const anchor = document.createElement("a");
        anchor.href = rule.href;
        anchor.classList.add("stat-keyword-link");
        anchor.setAttribute("data-auto-link", "stat-keyword");
        anchor.textContent = match[0];
        fragment.appendChild(anchor);
        lastIndex = match.index + match[0].length;
        replaced = true;
      }

      if (!replaced) return;
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      node.parentNode.replaceChild(fragment, node);
    });
  };

  activeRules.forEach(linkifyRule);
}

