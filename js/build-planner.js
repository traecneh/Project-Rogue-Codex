      (function () {
        const searchInput = document.getElementById("gear-search");
        const suggestionsEl = document.getElementById("gear-suggestions");
        const slotEls = new Map(
          Array.from(document.querySelectorAll(".slot-card")).map((card) => [card.dataset.slot, card])
        );

        let activeSuggestionIndex = -1;
        const getSuggestionItems = () =>
          suggestionsEl ? Array.from(suggestionsEl.querySelectorAll(".suggestion")) : [];

        const clearActiveSuggestion = () => {
          const items = getSuggestionItems();
          items.forEach((el) => {
            el.classList.remove("is-active");
            el.setAttribute("aria-selected", "false");
          });
          activeSuggestionIndex = -1;
        };

        const setActiveSuggestion = (nextIndex, { focus = true } = {}) => {
          const items = getSuggestionItems();
          if (!items.length) return;

          const index = Math.max(0, Math.min(nextIndex, items.length - 1));
          items.forEach((el, i) => {
            const isActive = i === index;
            el.classList.toggle("is-active", isActive);
            el.setAttribute("aria-selected", isActive ? "true" : "false");
          });
          activeSuggestionIndex = index;
          if (focus) items[index].focus();
        };

        const closeSuggestions = ({ keepContent = false } = {}) => {
          if (!suggestionsEl) return;
          clearActiveSuggestion();
          suggestionsEl.style.display = "none";
          if (!keepContent) suggestionsEl.innerHTML = "";
        };
        // URL-safe compression for share links.
        var LZString=function(){function o(o,r){if(!t[o]){t[o]={};for(var n=0;n<o.length;n++)t[o][o.charAt(n)]=n}return t[o][r]}var r=String.fromCharCode,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",t={},i={compressToBase64:function(o){if(null==o)return"";var r=i._compress(o,6,function(o){return n.charAt(o)});switch(r.length%4){default:case 0:return r;case 1:return r+"===";case 2:return r+"==";case 3:return r+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(e){return o(n,r.charAt(e))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(o){return null==o?"":""==o?null:i._decompress(o.length,16384,function(r){return o.charCodeAt(r)-32})},compressToUint8Array:function(o){for(var r=i.compress(o),n=new Uint8Array(2*r.length),e=0,t=r.length;t>e;e++){var s=r.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null===o||void 0===o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;t>e;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(o){return null==o?"":i._compress(o,6,function(o){return e.charAt(o)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(n){return o(e,r.charAt(n))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(o,r,n){if(null==o)return"";var e,t,i,s={},p={},u="",c="",a="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<o.length;i+=1)if(u=o.charAt(i),Object.prototype.hasOwnProperty.call(s,u)||(s[u]=f++,p[u]=!0),c=a+u,Object.prototype.hasOwnProperty.call(s,c))a=c;else{if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++),s[c]=f++,a=String(u)}if(""!==a){if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==r-1){d.push(n(m));break}v++}return d.join("")},decompress:function(o){return null==o?"":""==o?null:i._decompress(o.length,32768,function(r){return o.charCodeAt(r)})},_decompress:function(o,n,e){var t,i,s,p,u,c,a,l,f=[],h=4,d=4,m=3,v="",w=[],A={val:e(0),position:n,index:1};for(i=0;3>i;i+=1)f[i]=i;for(p=0,c=Math.pow(2,2),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(t=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 2:return""}for(f[3]=l,s=l,w.push(l);;){if(A.index>o)return"";for(p=0,c=Math.pow(2,m),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(l=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 2:return w.join("")}if(0==h&&(h=Math.pow(2,m),m++),f[l])v=f[l];else{if(l!==d)return null;v=s+s.charAt(0)}w.push(v),f[d++]=s+v.charAt(0),h--,s=v,0==h&&(h=Math.pow(2,m),m++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module&&(module.exports=LZString);
        const RARITY_TIERS = [
          { label: "Common", statMin: 0, statMax: 0, bonusAC: 0 },
          { label: "Uncommon", statMin: 2, statMax: 5, bonusAC: 0 },
          { label: "Rare", statMin: 6, statMax: 10, bonusAC: 0 },
          { label: "Epic", statMin: 11, statMax: 15, bonusAC: 2 },
          { label: "Legendary", statMin: 16, statMax: 20, bonusAC: 3 },
          { label: "Mythical", statMin: 21, statMax: 25, bonusAC: 4 },
          { label: "Ascendant", statMin: 26, statMax: 30, bonusAC: 5 },
        ];

        const rarityLabelIndex = RARITY_TIERS.reduce((acc, tier, idx) => {
          acc[tier.label.toLowerCase()] = idx;
          return acc;
        }, {});

        const RARITY_COLORS = {
          Common: "#ffffff",
          Uncommon: "#ffd966",
          Rare: "#0000ff",
          Epic: "#741b47",
          Legendary: "#ff9900",
          Mythical: "#6aa84f",
          Ascendant: "#ff0000",
        };

        const RESIST_COLORS = {
          fire: "#ff5a5a",
          electric: "#b86bff",
          poison: "#2f7a2f",
          cold: "#7cc9ff",
          acid: "#b38b00",
          disease: "#ff9c42",
        };

        const RACES = [
          { value: "", label: "Select race", bonus: { str: 0, dex: 0, con: 0 }, perk: null },
          { value: "human", label: "Human", bonus: { str: 0, dex: 0, con: 0 }, perk: "Desperation" },
          { value: "tundrian", label: "Tundrian", bonus: { str: 10, dex: 0, con: 0 }, perk: "Frozen Heart" },
          { value: "brimlock", label: "Brimlock", bonus: { str: 0, dex: 0, con: 5 }, perk: "Demon Blood" },
          { value: "komodan", label: "Komodan", bonus: { str: 0, dex: 0, con: 5 }, perk: "Magic Shield" },
          { value: "elf", label: "Elf", bonus: { str: 0, dex: 10, con: 0 }, perk: "Parry" },
          { value: "orc", label: "Orc", bonus: { str: 0, dex: 0, con: 10 }, perk: "Hazmat" },
          { value: "gnoll", label: "Gnoll", bonus: { str: 0, dex: 0, con: 5 }, perk: "Rejuvenation" },
          { value: "dark-elf", label: "Dark Elf", bonus: { str: 0, dex: 5, con: 0 }, perk: "Alchemist" },
        ];

        const normalizeRarityLabel = (label) => {
          const lower = String(label || "").toLowerCase().trim();
          if (!lower) return null;
          if (lower === "normal" || lower === "regular" || lower === "common") return "Common";
          return RARITY_TIERS.find((t) => t.label.toLowerCase() === lower)?.label || null;
        };

        const rarityIndexFromLabel = (label) => {
          const normalized = normalizeRarityLabel(label);
          if (!normalized) return 0;
          return rarityLabelIndex[normalized.toLowerCase()] ?? 0;
        };

        const rarityLabelFromValue = (value) => {
          if (value === null || value === undefined || value === "") return null;
          if (typeof value === "number") {
            return RARITY_TIERS[value] ? RARITY_TIERS[value].label : null;
          }
          return normalizeRarityLabel(value);
        };

        const totals = {
          armor: document.getElementById("sum-armor"),
          weight: document.getElementById("sum-weight"),
          dps: document.getElementById("sum-dps"),
          element: document.getElementById("sum-element"),
          toHit: document.getElementById("sum-tohit"),
          str: document.getElementById("sum-str"),
          con: document.getElementById("sum-con"),
          dex: document.getElementById("sum-dex"),
          resists: document.getElementById("sum-resists"),
          perks: document.getElementById("sum-perks"),
        };

        const selectedBySlot = {};
        let selectedSlotName = "";
        const quickSummaryEls = {
          armor: document.querySelector('[data-quick-stat="armor"]'),
          dps: document.querySelector('[data-quick-stat="dps"]'),
          weight: document.querySelector('[data-quick-stat="weight"]'),
          str: document.querySelector('[data-quick-stat="str"]'),
          con: document.querySelector('[data-quick-stat="con"]'),
          dex: document.querySelector('[data-quick-stat="dex"]'),
          health: document.querySelector('[data-quick-stat="health"]'),
          dr: document.querySelector('[data-quick-stat="dr"]'),
        };
        const SHORT_STATE_PARAM = "b";
        const LEGACY_STATE_PARAM = "build";
        const BUILD_STATE_VERSION = 1;
        const getBuildParamFromSearch = (search) => {
          const params = new URLSearchParams(search || "");
          return params.get(SHORT_STATE_PARAM) || params.get(LEGACY_STATE_PARAM) || "";
        };
        const hashBuildParam = (value) => {
          const str = String(value || "");
          let hash = 2166136261;
          for (let i = 0; i < str.length; i += 1) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
          }
          return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
        };
        const trackBuildEvent = (eventName, buildParam) => {
          if (typeof window.gtag !== "function") return;
          const raw = String(buildParam || "");
          if (!raw) return;
          window.gtag("event", eventName, {
            build_id: hashBuildParam(raw),
            build_len: raw.length,
            build_version: BUILD_STATE_VERSION,
          });
        };
        const initialBuildParam = getBuildParamFromSearch(window.location.search);
        const BASE_STAT_MIN = 5;
        const BASE_STAT_MAX = 200;
        const BASE_STAT_IDS = new Set(["char-str", "char-dex", "char-con"]);
        const BASE_STAT_START = BASE_STAT_MIN * BASE_STAT_IDS.size;
        const getBaseStatLimit = (level) => toNumber(level) * 2 + 8;
        const clampBaseStatValue = (value) => {
          const num = Number(value);
          if (!Number.isFinite(num)) return BASE_STAT_MIN;
          return Math.min(BASE_STAT_MAX, Math.max(BASE_STAT_MIN, Math.trunc(num)));
        };
        let perkOptions = [];
        let raceOptions = [];
        const raceSelect = document.getElementById("char-race");
        const populateRaceOptions = () => {
          if (!raceSelect) return;
          raceSelect.innerHTML = RACES.map(
            (r) => `<option value="${r.value}">${r.label}</option>`
          ).join("");
        };

        const getItemHref = (item) => {
          if (!item) return "";
          const name = String(item.name || "").trim();
          if (!name) return "";
          if (item.kind === "weapon") return `pages/items/weapons.html?weapon=${encodeURIComponent(name)}`;
          if (item.kind === "armor") return `pages/items/armors.html?armor=${encodeURIComponent(name)}`;
          return "";
        };

        const deriveImageCandidates = (item, folder = "weapons") => {
          const candidates = [];
          const direct = typeof item === "string" ? item : item && item.image;
          if (direct) candidates.push(direct);
          const name = (item && (item.name || item.Name || item.id)) || "";
          const safeName = String(name).replace(/[\\/:*?"<>|]/g, "").trim();
          if (safeName) {
            const bases = [
              `images/${folder}`,
              `../images/${folder}`,
              `../../images/${folder}`,
              `/images/${folder}`,
            ];
            bases.forEach((base) => {
              const encoded = encodeURI(`${base}/${safeName}`);
              candidates.push(`${encoded}.gif`, `${encoded}.GIF`, `${encoded}.png`, `${encoded}.PNG`);
            });
          }
          return Array.from(new Set(candidates.filter(Boolean)));
        };

        const setSlotImage = (slot, item, folder, options = {}) => {
          const restoreState = options && typeof options === "object" ? options.restoreState : null;
          const skipPersist = Boolean(options && typeof options === "object" && options.skipPersist);
          const card = slotEls.get(slot);
          if (!card) return;
          const img = card.querySelector(".slot-image");
          const placeholder = card.querySelector(".slot-placeholder");
          if (!img || !placeholder) return;
          card.classList.add("has-item");
          const titleEl = card.querySelector("[data-slot-item]");
          if (titleEl) {
            const itemName = String(item?.name || "").trim();
            titleEl.textContent = itemName || "Unknown";
            const href = getItemHref(item);
            if (href) {
              titleEl.setAttribute("href", href);
              titleEl.tabIndex = 0;
              titleEl.setAttribute("aria-label", `Open ${itemName}`);
            } else {
              titleEl.removeAttribute("href");
              titleEl.tabIndex = -1;
              titleEl.removeAttribute("aria-label");
            }
          }
          const maxRarityLabel = item.maxRarityLabel || item.max_rarity_label || item.max_rarity;
          const maxRarityIndex = Math.min(
            RARITY_TIERS.length - 1,
            rarityIndexFromLabel(maxRarityLabel !== undefined ? maxRarityLabel : 0)
          );

          const restoredRarityIndex = restoreState ? Math.max(0, Number(restoreState.rarityIndex) || 0) : 0;
          const rarityIndex = restoreState
            ? Math.min(maxRarityIndex, restoredRarityIndex)
            : 0; // start at Common for new selections
          selectedBySlot[slot] = {
            ...item,
            rarityIndex,
            maxRarityIndex,
            bonusStr: 0,
            bonusDex: 0,
            bonusCon: 0,
            bonusAC: 0,
            bonusResists: { fire: 0, cold: 0, electric: 0, acid: 0, poison: 0, disease: 0 },
          };

          if (restoreState) {
            const data = selectedBySlot[slot];
            const restoredExtraPerkName = restoreState.extraPerkName || null;
            data.extraPerkName = restoredExtraPerkName === "Touriquet" ? "Tourniquet" : restoredExtraPerkName;
            data.extraPerkTier = restoreState.extraPerkTier || null;
            data.bonusStr = typeof restoreState.bonusStr === "number" ? restoreState.bonusStr : 0;
            data.bonusDex = typeof restoreState.bonusDex === "number" ? restoreState.bonusDex : 0;
            data.bonusCon = typeof restoreState.bonusCon === "number" ? restoreState.bonusCon : 0;

            const tier = getRarityTier(data.rarityIndex);
            data.bonusAC = tier.bonusAC;
            normalizeRarityBonuses(data);
          } else {
            rollRarityBonuses(slot);
          }

          updateSlotRarityUI(slot);
          updateSlotPerkUI(slot);
          selectSlot(slot);
          updatePlannerStatus();
          const sources = deriveImageCandidates(item, folder);
          if (!sources.length) {
            img.style.display = "none";
            placeholder.style.display = "flex";
            updateTotals();
            return;
          }
          let index = 0;
          const trySet = () => {
            img.onload = () => {
              img.style.display = "block";
              placeholder.style.display = "none";
              updateTotals();
            };
            img.onerror = () => {
              index += 1;
              if (index < sources.length) {
                trySet();
              } else {
                img.style.display = "none";
                placeholder.style.display = "flex";
                updateTotals();
              }
            };
            img.src = sources[index];
           };
           trySet();
          if (!skipPersist) schedulePersistState();
        };

        const clearSlot = (slot) => {
          const card = slotEls.get(slot);
          if (!card) return;
          const img = card.querySelector(".slot-image");
          const placeholder = card.querySelector(".slot-placeholder");
          const titleEl = card.querySelector("[data-slot-item]");
          if (img) {
            img.removeAttribute("src");
            img.style.display = "none";
          }
          if (placeholder) {
            placeholder.style.display = "flex";
          }
          if (titleEl) {
            titleEl.textContent = "";
            titleEl.removeAttribute("href");
            titleEl.tabIndex = -1;
            titleEl.removeAttribute("aria-label");
          }
          card.classList.remove("has-item");
          delete selectedBySlot[slot];
          updateSlotPerkUI(slot, true);
          updateSlotRarityUI(slot);
          updateStatAdjustUI(slot);
          updateTotals();
          if (selectedSlotName === slot) selectSlot("");
          updatePlannerStatus();
          schedulePersistState();
        };

        const updatePlannerStatus = () => {
          const status = document.getElementById("planner-status");
          if (!status) return;
          const selectedCount = Object.keys(selectedBySlot).length;
          const level = getCharStat("char-level");
          const baseStatLimit = getBaseStatLimit(level);
          const baseStatSpent = Math.max(
            0,
            getCharStat("char-str") + getCharStat("char-dex") + getCharStat("char-con") - BASE_STAT_START
          );
          const remaining = baseStatLimit - baseStatSpent;
          const statText = remaining >= 0 ? `${remaining} stat pts open` : `${Math.abs(remaining)} stat pts over`;
          status.textContent = `${selectedCount} / ${slotEls.size} slots selected · ${statText}`;
        };

        const selectSlot = (slot) => {
          selectedSlotName = slot || "";
          slotEls.forEach((card, cardSlot) => {
            card.classList.toggle("is-selected", Boolean(selectedSlotName && cardSlot === selectedSlotName));
          });
          updateSlotEditor();
        };

        const getBonusStatKey = (stat) => {
          if (stat === "str") return "bonusStr";
          if (stat === "dex") return "bonusDex";
          if (stat === "con") return "bonusCon";
          return "";
        };

        const escapeHtml = (value) =>
          String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        const updateSlotEditor = () => {
          const editor = document.getElementById("slot-editor");
          if (!editor) return;
          const slot = selectedSlotName;
          const data = slot ? selectedBySlot[slot] : null;
          if (!slot || !data) {
            editor.innerHTML =
              '<div class="slot-editor-empty">Select a filled slot to edit rarity, bonus stats, and extra perk.</div>';
            return;
          }

          normalizeRarityBonuses(data);
          const rarity = getRarityTier(data.rarityIndex);
          const maxTier = getRarityTier(data.maxRarityIndex);
          const cap = getRarityStatCap(data.rarityIndex);
          const used = getBonusStatSum(data);
          const showExtraPerk = data.rarityIndex >= 3;
          const perkChoices = perkOptions
            .map((name) => {
              const selected = name === data.extraPerkName ? " selected" : "";
              const safeName = escapeHtml(name);
              return `<option value="${safeName}"${selected}>${safeName}</option>`;
            })
            .join("");
          const tierChoices = [1, 2, 3]
            .map((tier) => {
              const selected = tier === toNumber(data.extraPerkTier || 1) ? " selected" : "";
              return `<option value="${tier}"${selected}>T${tier}</option>`;
            })
            .join("");

          editor.innerHTML = `
            <div class="slot-editor-header">
              <div>
                <div class="slot-label">${escapeHtml(slot)}</div>
                <a class="slot-name slot-item-link" href="${escapeHtml(getItemHref(data))}">${escapeHtml(
                  data.name || "Unknown"
                )}</a>
              </div>
              <button type="button" class="slot-clear is-visible" data-editor-clear>Clear</button>
            </div>
            <div class="slot-editor-row">
              <span>Rarity</span>
              <div class="slot-editor-controls">
                <button type="button" class="rarity-btn" data-editor-rarity-dec>-</button>
                <strong style="color: ${RARITY_COLORS[rarity.label] || "var(--text-main)"}">${rarity.label}</strong>
                <button type="button" class="rarity-btn" data-editor-rarity-inc>+</button>
              </div>
            </div>
            <div class="slot-editor-row">
              <span>Max rarity</span>
              <span>${maxTier.label}</span>
            </div>
            <div class="slot-editor-row">
              <span>Bonus Stats</span>
              <span>${used} / ${cap}</span>
            </div>
            <div class="slot-editor-stat-grid">
              ${["str", "dex", "con"]
                .map((stat) => {
                  const key = getBonusStatKey(stat);
                  return `
                    <div class="stat-row" data-editor-stat="${stat}">
                      <button type="button" class="rarity-btn" data-editor-stat-dec>-</button>
                      <span class="stat-value">${toNumber(data[key])}</span>
                      <button type="button" class="rarity-btn" data-editor-stat-inc>+</button>
                      <span class="stat-label">${stat.toUpperCase()}</span>
                    </div>
                  `;
                })
                .join("")}
            </div>
            <div class="slot-editor-row slot-editor-perk-row">
              <span>Extra Perk</span>
              <div class="slot-editor-controls">
                <select data-editor-perk ${showExtraPerk ? "" : "disabled"}>
                  <option value="">None</option>
                  ${perkChoices}
                </select>
                <select data-editor-perk-tier ${showExtraPerk ? "" : "disabled"}>
                  ${tierChoices}
                </select>
              </div>
            </div>
          `;

          editor.querySelector("[data-editor-clear]")?.addEventListener("click", () => clearSlot(slot));
          editor.querySelector("[data-editor-rarity-dec]")?.addEventListener("click", () => adjustRarity(slot, -1));
          editor.querySelector("[data-editor-rarity-inc]")?.addEventListener("click", () => adjustRarity(slot, 1));
          editor.querySelector("[data-editor-rarity-dec]")?.toggleAttribute("disabled", data.rarityIndex <= 0);
          editor
            .querySelector("[data-editor-rarity-inc]")
            ?.toggleAttribute("disabled", data.rarityIndex >= data.maxRarityIndex);

          const remaining = Math.max(0, cap - used);
          editor.querySelectorAll("[data-editor-stat]").forEach((row) => {
            const stat = row.dataset.editorStat;
            const key = getBonusStatKey(stat);
            const current = toNumber(data[key]);
            const decBtn = row.querySelector("[data-editor-stat-dec]");
            const incBtn = row.querySelector("[data-editor-stat-inc]");
            decBtn?.addEventListener("click", () => adjustStat(slot, stat, -1));
            incBtn?.addEventListener("click", () => adjustStat(slot, stat, 1));
            decBtn?.toggleAttribute("disabled", data.rarityIndex < 1 || current <= 0);
            incBtn?.toggleAttribute("disabled", data.rarityIndex < 1 || remaining <= 0);
          });

          const perkSelect = editor.querySelector("[data-editor-perk]");
          const perkTierSelect = editor.querySelector("[data-editor-perk-tier]");
          perkSelect?.addEventListener("change", () => {
            data.extraPerkName = perkSelect.value || null;
            data.extraPerkTier = data.extraPerkName ? Number(perkTierSelect?.value || 1) || 1 : null;
            updateSlotPerkUI(slot);
            updateTotals();
            schedulePersistState();
          });
          perkTierSelect?.addEventListener("change", () => {
            data.extraPerkTier = data.extraPerkName ? Number(perkTierSelect.value) || 1 : null;
            updateSlotPerkUI(slot);
            updateTotals();
            schedulePersistState();
          });
        };

        const dataset = {
          weapons: [],
          armors: [],
        };

        const trimTrailingDefaults = (values) => {
          if (!Array.isArray(values)) return [];
          let end = values.length;
          while (end > 0) {
            const value = values[end - 1];
            if (value === 0 || value === "" || value === null || value === undefined) {
              end -= 1;
            } else {
              break;
            }
          }
          return values.slice(0, end);
        };

        const packState = (state) => {
          if (!state) return null;
          const char = state.char || {};
          const slots = Array.isArray(state.slots) ? state.slots : [];
          return {
            v: BUILD_STATE_VERSION,
            c: [
              toNumber(char.level),
              toNumber(char.str),
              toNumber(char.dex),
              toNumber(char.con),
              toNumber(char.skill),
              char.race || "",
            ],
            s: slots.map((entry) =>
              trimTrailingDefaults([
                entry.slot || "",
                entry.kind === "weapon" ? 1 : entry.kind === "armor" ? 2 : 0,
                entry.name || "",
                toNumber(entry.rarityIndex),
                entry.extraPerkName || "",
                toNumber(entry.extraPerkTier || 0),
                toNumber(entry.bonusStr),
                toNumber(entry.bonusDex),
                toNumber(entry.bonusCon),
              ])
            ),
          };
        };

        const unpackState = (packed) => {
          if (!packed || !Array.isArray(packed.c)) return null;
          const [level, str, dex, con, skill, race] = packed.c;
          const slots = Array.isArray(packed.s) ? packed.s : [];
          const decodedSlots = slots
            .map((entry) => {
              if (!Array.isArray(entry)) return null;
              const slot = entry[0] || "";
              const kindCode = entry[1] || 0;
              const name = entry[2] || "";
              if (!slot || !name) return null;
              return {
                slot,
                kind: kindCode === 1 ? "weapon" : kindCode === 2 ? "armor" : "",
                name,
                rarityIndex: toNumber(entry[3]),
                extraPerkName: entry[4] ? String(entry[4]) : null,
                extraPerkTier: entry[5] ? toNumber(entry[5]) : null,
                bonusStr: toNumber(entry[6]),
                bonusDex: toNumber(entry[7]),
                bonusCon: toNumber(entry[8]),
              };
            })
            .filter(Boolean);
          return {
            slots: decodedSlots,
            char: {
              level: toNumber(level),
              str: toNumber(str),
              dex: toNumber(dex),
              con: toNumber(con),
              skill: toNumber(skill),
              race: race || "",
            },
          };
        };

        const encodeState = () => {
          const entries = Object.entries(selectedBySlot).map(([slot, item]) => ({
            slot,
            name: item.name,
            kind: item.kind,
            rarityIndex: item.rarityIndex,
            extraPerkName: item.extraPerkName || null,
            extraPerkTier: item.extraPerkTier || null,
            bonusStr: item.bonusStr ?? null,
            bonusDex: item.bonusDex ?? null,
            bonusCon: item.bonusCon ?? null,
          }));

          const char = {
            level: toNumber(document.getElementById("char-level")?.value),
            str: toNumber(document.getElementById("char-str")?.value),
            dex: toNumber(document.getElementById("char-dex")?.value),
            con: toNumber(document.getElementById("char-con")?.value),
            skill: toNumber(document.getElementById("char-skill")?.value),
            race: document.getElementById("char-race")?.value || "",
          };

          return { slots: entries, char };
        };

        const encodeStateForUrl = (state) => {
          if (!state) return "";
          try {
            const packed = packState(state);
            if (!packed) return "";
            return LZString.compressToEncodedURIComponent(JSON.stringify(packed)) || "";
          } catch (error) {
            return "";
          }
        };

        const decodeStatePayload = (raw) => {
          if (!raw) return null;
          const trimmed = String(raw || "").trim();
          let parsed = null;
          try {
            const decompressed = LZString.decompressFromEncodedURIComponent(trimmed);
            if (decompressed) {
              parsed = JSON.parse(decompressed);
            }
          } catch (error) {
            parsed = null;
          }
          if (!parsed && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
            try {
              parsed = JSON.parse(trimmed);
            } catch (error) {
              parsed = null;
            }
          }
          if (!parsed) return null;
          if (Array.isArray(parsed.c) && Array.isArray(parsed.s)) {
            return unpackState(parsed);
          }
          if (Array.isArray(parsed.slots)) {
            return parsed;
          }
          return null;
        };

        const persistState = () => {
          try {
            const state = encodeState();
            const encoded = encodeStateForUrl(state);
            const url = new URL(window.location.href);
            if (encoded) {
              url.searchParams.set(SHORT_STATE_PARAM, encoded);
              url.searchParams.delete(LEGACY_STATE_PARAM);
            } else {
              url.searchParams.delete(SHORT_STATE_PARAM);
              url.searchParams.delete(LEGACY_STATE_PARAM);
            }
            window.history.replaceState({}, "", url.toString());
          } catch (error) {
            /* ignore */
          }
        };

        let persistTimer = null;
        const schedulePersistState = (delay = 200) => {
          if (persistTimer) window.clearTimeout(persistTimer);
          persistTimer = window.setTimeout(() => {
            persistTimer = null;
            persistState();
          }, delay);
        };
        const persistStateNow = () => {
          if (persistTimer) window.clearTimeout(persistTimer);
          persistTimer = null;
          persistState();
        };

        const decodeState = () => {
          try {
            const url = new URL(window.location.href);
            const raw = url.searchParams.get(SHORT_STATE_PARAM);
            const legacyRaw = url.searchParams.get(LEGACY_STATE_PARAM);
            const decoded = raw ? decodeStatePayload(raw) : null;
            if (decoded) return decoded;
            if (!legacyRaw) return null;
            return decodeStatePayload(legacyRaw);
          } catch (error) {
            return null;
          }
        };

        const applySavedState = () => {
          const state = decodeState();
          if (!state) return;
          const findItem = (kind, name) => {
            const list = kind === "weapon" ? dataset.weapons : dataset.armors;
            const lower = String(name || "").toLowerCase();
            return list.find((item) => String(item.name || "").toLowerCase() === lower);
          };
          state.slots.forEach((entry) => {
            const item = findItem(entry.kind, entry.name);
            if (!item) return;
            const folder = entry.kind === "weapon" ? "weapons" : "armors";
            setSlotImage(entry.slot, item, folder, { restoreState: entry, skipPersist: true });
          });

          if (state.char) {
            const setVal = (id, val) => {
              const el = document.getElementById(id);
              if (!el) return;
              if (BASE_STAT_IDS.has(id)) {
                el.value = clampBaseStatValue(val);
                return;
              }
              el.value = val;
            };
            setVal("char-level", state.char.level);
            setVal("char-str", state.char.str);
            setVal("char-dex", state.char.dex);
            setVal("char-con", state.char.con);
            setVal("char-skill", state.char.skill);
            setVal("char-race", state.char.race || "");
          }

          updateTotals();
        };

        const wireCharacterSliders = () => {
          const sliders = [
            { id: "char-level", label: "val-level" },
            { id: "char-str", label: "val-str" },
            { id: "char-dex", label: "val-dex" },
            { id: "char-con", label: "val-con" },
            { id: "char-skill", label: "val-skill" },
          ];
          sliders.forEach(({ id, label }) => {
            const input = document.getElementById(id);
            const valueEl = document.getElementById(label);
            if (!input || !valueEl) return;
            const update = (shouldPersist = false) => {
              if (BASE_STAT_IDS.has(id)) {
                input.value = clampBaseStatValue(input.value);
              }
              valueEl.textContent = input.value;
              updateTotals();
              if (shouldPersist) schedulePersistState();
            };
            input.addEventListener("input", () => update(true));
            update(false);
          });
          if (raceSelect) {
            if (!raceSelect.options.length) populateRaceOptions();
            raceSelect.addEventListener("change", () => {
              updateTotals();
              schedulePersistState();
            });
          }
        };

        const toNumber = (value) => {
          const num = Number(value);
          return Number.isNaN(num) ? 0 : num;
        };

        const sumObjects = (list, key) => list.reduce((acc, obj) => acc + toNumber(obj?.[key]), 0);

        const getRarityTier = (rarityIndex) => RARITY_TIERS[rarityIndex] || RARITY_TIERS[0];

        const getRarityStatCap = (rarityIndex) => {
          const tier = getRarityTier(rarityIndex);
          const max = Number(tier?.statMax);
          return Number.isFinite(max) ? Math.min(30, Math.max(0, Math.trunc(max))) : 0;
        };

        const getBonusStatSum = (data) =>
          toNumber(data?.bonusStr) + toNumber(data?.bonusDex) + toNumber(data?.bonusCon);

        const normalizeRarityBonuses = (data) => {
          if (!data) return;
          data.bonusStr = Math.max(0, Math.trunc(toNumber(data.bonusStr)));
          data.bonusDex = Math.max(0, Math.trunc(toNumber(data.bonusDex)));
          data.bonusCon = Math.max(0, Math.trunc(toNumber(data.bonusCon)));

          const cap = getRarityStatCap(data.rarityIndex);
          let sum = getBonusStatSum(data);
          if (sum <= cap) return;

          let overflow = sum - cap;
          const keys = ["bonusStr", "bonusDex", "bonusCon"].sort((a, b) => toNumber(data[b]) - toNumber(data[a]));
          for (const key of keys) {
            if (overflow <= 0) break;
            const current = toNumber(data[key]);
            const reduce = Math.min(current, overflow);
            data[key] = current - reduce;
            overflow -= reduce;
          }
        };

        const allocateStats = (total) => {
          let remaining = Math.max(0, Math.round(total));
          const dist = { str: 0, dex: 0, con: 0 };
          const keys = ["str", "dex", "con"];
          while (remaining > 0) {
            const key = keys[Math.floor(Math.random() * keys.length)];
            dist[key] += 1;
            remaining -= 1;
          }
          return dist;
        };

        const getCharStat = (id) => {
          const el = document.getElementById(id);
          const value = el ? toNumber(el.value) : 0;
          if (BASE_STAT_IDS.has(id)) {
            return clampBaseStatValue(value);
          }
          return value;
        };

        const getRaceData = (value) => RACES.find((r) => r.value === value) || RACES[0];

        const getRaceTier = (level) => {
          if (level >= 100) return 3;
          if (level >= 71) return 2;
          return 1;
        };

        const isSlotZero = (slotValue) =>
          slotValue === 0 || (typeof slotValue === "string" && slotValue.trim() === "0");

        const toArmor = (raw) => {
          const fields = (raw && raw.fields) || {};
          const electric = fields.electric_resistance ?? fields.lightning_resistance;
          const slotRaw = fields.slot_label ?? fields.slot;
          if (isSlotZero(slotRaw)) return null;
          return {
            kind: "armor",
            name: raw.name || raw.Name,
            slot: slotRaw || "",
            image: raw.image || raw.icon || raw.thumbnail || "",
            maxRarityLabel: fields.max_rarity_label || fields.max_rarity,
            armor: toNumber(fields.armor),
            weight: toNumber(fields.weight),
            toHit: toNumber(fields.to_hit),
            strength: toNumber(fields.strength),
            constitution: toNumber(fields.constitution),
            dexterity: toNumber(fields.dexterity),
            resistances: {
              fire: toNumber(fields.fire_resistance),
              cold: toNumber(fields.cold_resistance),
              electric: toNumber(electric),
              acid: toNumber(fields.acid_resistance),
              poison: toNumber(fields.poison_resistance),
              disease: toNumber(fields.disease_resistance),
            },
            perk: fields.perk ? fields.perk_label || fields.perk : null,
            corruptedPerk: fields.corrupted_perk
              ? fields.corrupted_perk_label || fields.corrupted_perk
              : null,
          };
        };

        const computeDps = (minDamage, maxDamage, attackSpeed) => {
          const min = Number(minDamage);
          const max = Number(maxDamage);
          const speed = Number(attackSpeed);
          if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(speed) || speed === 0) return 0;
          const avgDamage = (min + max) / 2;
          return Number((avgDamage * (1000 / speed)).toFixed(2));
        };

        const toWeapon = (raw) => {
          const fields = (raw && raw.fields) || {};
          const dps = computeDps(fields.min_damage, fields.max_damage, fields.attack_speed);
          return {
            kind: "weapon",
            name: raw.name || raw.Name,
            slot: "Weapon",
            image: raw.image || raw.icon || raw.thumbnail || "",
            maxRarityLabel: fields.max_rarity_label || fields.max_rarity,
            dps,
            element: fields.element_label || (fields.element ? fields.element : "None"),
            toHit: toNumber(fields.to_hit),
            strength: toNumber(fields.strength),
            constitution: toNumber(fields.constitution),
            dexterity: toNumber(fields.dexterity),
            resistances: {
              fire: toNumber(fields.fire_resistance),
              cold: toNumber(fields.cold_resistance),
              electric: toNumber(fields.electric_resistance),
              acid: toNumber(fields.acid_resistance),
              poison: toNumber(fields.poison_resistance),
              disease: toNumber(fields.disease_resistance),
            },
            perk: fields.perk ? fields.perk_label || fields.perk : null,
          };
        };

        const formatResists = (res, options = {}) => {
          const includeZero = Boolean(options.includeZero);
          const entries = [];
          const labels = {
            fire: "Fire",
            cold: "Cold",
            electric: "Electric",
            acid: "Acid",
            poison: "Poison",
            disease: "Disease",
          };
          Object.entries(labels).forEach(([key, label]) => {
            const value = toNumber(res ? res[key] : 0);
            if (value !== 0 || includeZero) {
              entries.push({ label, value, color: RESIST_COLORS[key] });
            }
          });
          return entries;
        };

        const rollRarityBonuses = (slot) => {
          const data = selectedBySlot[slot];
          if (!data) return;
          const tier = RARITY_TIERS[data.rarityIndex] || RARITY_TIERS[0];
          const statTotal =
            tier.statMin === tier.statMax
              ? tier.statMin
              : Math.floor(Math.random() * (tier.statMax - tier.statMin + 1)) + tier.statMin;
          const stats = allocateStats(statTotal);
          data.bonusStr = stats.str;
          data.bonusDex = stats.dex;
          data.bonusCon = stats.con;
          data.bonusAC = tier.bonusAC;
          data.bonusResists = { fire: 0, cold: 0, electric: 0, acid: 0, poison: 0, disease: 0 };
        };

        const updateStatAdjustUI = (slot) => {
          const card = slotEls.get(slot);
          if (!card) return;
          const row = card.querySelector("[data-stat-row]");
          const data = selectedBySlot[slot];
          if (!row || !data || data.rarityIndex < 1) {
            if (row) row.style.display = "none";
            return;
          }
          row.style.display = "flex";
          normalizeRarityBonuses(data);
          const cap = getRarityStatCap(data.rarityIndex);
          const sum = getBonusStatSum(data);
          const remaining = Math.max(0, cap - sum);
          row.title = `Rarity bonus stats: ${sum}/${cap} (remaining ${remaining})`;
          row.querySelectorAll(".stat-row").forEach((container) => {
            const stat = container.dataset.stat;
            const valEl = container.querySelector("[data-stat-value]");
            if (!valEl) return;
            const current =
              stat === "str" ? data.bonusStr : stat === "dex" ? data.bonusDex : stat === "con" ? data.bonusCon : 0;
            valEl.textContent = current;
            const decBtn = container.querySelector("[data-stat-dec]");
            const incBtn = container.querySelector("[data-stat-inc]");
            if (decBtn) decBtn.disabled = current <= 0;
            if (incBtn) incBtn.disabled = remaining <= 0;
          });
          if (selectedSlotName === slot) updateSlotEditor();
        };

        const updateSlotPerkUI = (slot, clearOnly = false) => {
          const card = slotEls.get(slot);
          if (!card) return;
          const row = card.querySelector("[data-perk-row]");
          const select = card.querySelector("[data-perk-select]");
          const tierSelect = card.querySelector("[data-perk-tier]");
          const data = selectedBySlot[slot];

          if (clearOnly || !data || data.rarityIndex < 3) {
            if (row) row.style.display = "none";
            if (select) select.value = "";
            if (tierSelect) tierSelect.value = "1";
            if (data) {
              data.extraPerkName = null;
              data.extraPerkTier = null;
            }
            return;
          }

          if (row) row.style.display = "flex";

          const ensureOptions = () => {
            if (!select) return;
            if (select.dataset.bound === "true") return;
            select.innerHTML = '<option value="">Select perk</option>';
            perkOptions.forEach((name) => {
              const opt = document.createElement("option");
              opt.value = name;
              opt.textContent = name;
              select.appendChild(opt);
            });
            select.dataset.bound = "true";
            select.addEventListener("change", () => {
              data.extraPerkName = select.value || null;
              schedulePersistState();
              updateTotals();
            });
            if (tierSelect) {
              tierSelect.addEventListener("change", () => {
                data.extraPerkTier = Number(tierSelect.value) || 1;
                schedulePersistState();
                updateTotals();
              });
            }
          };

          ensureOptions();

          if (select) select.value = data.extraPerkName || "";
          if (tierSelect) tierSelect.value = String(data.extraPerkTier || 1);
        };

        const updateSlotRarityUI = (slot) => {
          const card = slotEls.get(slot);
          if (!card) return;
          const labelEl = card.querySelector("[data-rarity-label]");
          const maxEl = card.querySelector("[data-rarity-max]");
          const incBtn = card.querySelector("[data-rarity-inc]");
          const decBtn = card.querySelector("[data-rarity-dec]");
          const data = selectedBySlot[slot];

          if (!data) {
            if (labelEl) labelEl.textContent = "-";
            if (maxEl) maxEl.textContent = "";
            if (incBtn) incBtn.disabled = true;
            if (decBtn) decBtn.disabled = true;
            if (labelEl) labelEl.style.color = "var(--text-main)";
            if (labelEl) labelEl.title = "";
            return;
          }

          const tier = RARITY_TIERS[data.rarityIndex] || RARITY_TIERS[0];
          const maxTier = RARITY_TIERS[data.maxRarityIndex] || RARITY_TIERS[RARITY_TIERS.length - 1];
          if (labelEl) labelEl.textContent = tier.label;
          if (labelEl) labelEl.style.color = RARITY_COLORS[tier.label] || "var(--text-main)";
          if (maxEl) maxEl.textContent = "";
          if (labelEl) labelEl.title = `Max rarity: ${maxTier.label}`;
          if (incBtn) incBtn.disabled = data.rarityIndex >= data.maxRarityIndex;
          if (decBtn) decBtn.disabled = data.rarityIndex <= 0;
          updateSlotPerkUI(slot);
          updateStatAdjustUI(slot);
          if (selectedSlotName === slot) updateSlotEditor();
        };

        const updateTotals = () => {
          const selected = Object.values(selectedBySlot || {});
          const armors = selected.filter((i) => i.kind === "armor");
          const weapons = selected.filter((i) => i.kind === "weapon");
          const weapon = weapons[0];

          const totalArmor = sumObjects(armors, "armor") + selected.reduce((acc, a) => acc + toNumber(a.bonusAC), 0);
          const baseArmor = sumObjects(armors, "armor");
          const rarityArmor = selected.reduce((acc, a) => acc + toNumber(a.bonusAC), 0);
          const totalWeight = sumObjects(armors, "weight");
          const totalToHit = sumObjects(selected, "toHit");
          const baseStr = sumObjects(selected, "strength");
          const baseCon = sumObjects(selected, "constitution");
          const baseDex = sumObjects(selected, "dexterity");
          const bonusStr = sumObjects(selected, "bonusStr");
          const bonusCon = sumObjects(selected, "bonusCon");
          const bonusDex = sumObjects(selected, "bonusDex");
          const charStr = getCharStat("char-str");
          const charDex = getCharStat("char-dex");
          const charCon = getCharStat("char-con");
          const charLevel = getCharStat("char-level");
          const race = getRaceData(raceSelect ? raceSelect.value : "");
          const raceBonusStr = race?.bonus?.str || 0;
          const raceBonusDex = race?.bonus?.dex || 0;
          const raceBonusCon = race?.bonus?.con || 0;
          const baseStrWithChar = baseStr + charStr;
          const baseDexWithChar = baseDex + charDex;
          const baseConWithChar = baseCon + charCon;
          const totalStr = baseStrWithChar + bonusStr;
          const totalCon = baseConWithChar + bonusCon;
          const totalDex = baseDexWithChar + bonusDex;
          const totalDps = weapon ? toNumber(weapon.dps) : 0;
          const element = weapon && weapon.element ? weapon.element : "None";
          const baseStatTotal = charStr + charDex + charCon;
          const baseStatLimit = getBaseStatLimit(charLevel);
          const baseStatSpent = Math.max(0, baseStatTotal - BASE_STAT_START);

          const resistTotals = ["fire", "cold", "electric", "acid", "poison", "disease"].reduce((acc, key) => {
            acc[key] =
              selected.reduce((sum, item) => sum + toNumber(item.resistances?.[key]), 0) +
              selected.reduce((sum, item) => sum + toNumber(item.bonusResists?.[key]), 0);
            return acc;
          }, {});

          const perkSet = new Set(
            selected
              .map((i) => i.perk)
              .filter((p) => p && String(p).trim())
              .map((p) => String(p).trim())
          );
          selected.forEach((i) => {
            if (i.corruptedPerk && String(i.corruptedPerk).trim()) {
              perkSet.add(String(i.corruptedPerk).trim());
            }
            if (i.extraPerkName) {
              const tier = i.extraPerkTier || 1;
              perkSet.add(`${i.extraPerkName} (T${tier})`);
            }
          });
          const raceTier = getRaceTier(charLevel);
          if (race && race.perk) {
            perkSet.add(`${race.perk} (T${raceTier})`);
          }

          if (totals.armor) totals.armor.textContent = totalArmor;
          if (totals.armor)
            totals.armor.title = `Base armor: ${baseArmor}\nRarity bonus: ${rarityArmor}`;
          if (totals.weight) totals.weight.textContent = totalWeight;
          if (totals.dps) totals.dps.textContent = totalDps;
          if (totals.element) totals.element.textContent = element || "None";
          if (totals.toHit) totals.toHit.textContent = totalToHit;
          if (totals.str) {
            totals.str.textContent = totalStr;
            totals.str.title = `Base: ${baseStrWithChar} (items ${baseStr} + character ${charStr})\nRarity bonus: ${bonusStr}`;
          }
          if (totals.con) {
            totals.con.textContent = totalCon;
            totals.con.title = `Base: ${baseConWithChar} (items ${baseCon} + character ${charCon})\nRarity bonus: ${bonusCon}`;
          }
          if (totals.dex) {
            totals.dex.textContent = totalDex;
            totals.dex.title = `Base: ${baseDexWithChar} (items ${baseDex} + character ${charDex})\nRarity bonus: ${bonusDex}`;
          }

          const baseStatWarningEl = document.getElementById("base-stat-warning");
          const baseStatUnallocatedEl = document.getElementById("base-stat-unallocated");
          const baseStatRemaining = baseStatLimit - baseStatSpent;
          if (baseStatWarningEl) {
            if (baseStatRemaining < 0) {
              baseStatWarningEl.textContent = `Base stat points over cap (${baseStatSpent} / ${baseStatLimit}).`;
              baseStatWarningEl.style.display = "block";
            } else {
              baseStatWarningEl.textContent = "";
              baseStatWarningEl.style.display = "none";
            }
          }
          if (baseStatUnallocatedEl) {
            if (baseStatRemaining > 0) {
              baseStatUnallocatedEl.textContent = `Unallocated base stat points: ${baseStatRemaining}.`;
              baseStatUnallocatedEl.style.display = "block";
            } else {
              baseStatUnallocatedEl.textContent = "";
              baseStatUnallocatedEl.style.display = "none";
            }
          }

          if (totals.resists) {
            const list = formatResists(resistTotals, { includeZero: true });
            const hasAny = list.some((entry) => toNumber(entry.value) !== 0);
            if (!hasAny) {
              totals.resists.textContent = "None";
            } else {
              totals.resists.innerHTML = "";
              list.forEach((item) => {
                const chip = document.createElement("span");
                chip.className = "summary-chip";
                chip.textContent = `${item.label} ${item.value}`;
                if (item.color) {
                  chip.style.color = item.color;
                  chip.style.borderColor = item.color;
                }
                if (toNumber(item.value) === 0) {
                  chip.setAttribute("data-muted", "true");
                }
                totals.resists.appendChild(chip);
              });
            }
          }

          if (totals.perks) {
            if (!perkSet.size) {
              totals.perks.textContent = "None";
            } else {
              const utils = window.RogueCodexUtils || {};
              const getPerkTierColor = utils.getPerkTierColor || (() => "");
              totals.perks.innerHTML = "";
              Array.from(perkSet).forEach((perk) => {
                const chip = document.createElement("span");
                chip.className = "summary-chip";
                chip.textContent = perk;
                const color = getPerkTierColor(perk);
                if (color) {
                  chip.style.color = color;
                  chip.style.borderColor = color;
                }
                totals.perks.appendChild(chip);
              });
            }
          }

          const maxHealth = 20 + charLevel * 15 + totalCon * 10 + totalStr * 2;
          const maxHealthEl = document.getElementById("calc-max-health");
          if (maxHealthEl) {
            maxHealthEl.textContent = maxHealth;
            maxHealthEl.title = `20 + (Level ${charLevel} * 15) + (Con ${totalCon} * 10) + (Str ${totalStr} * 2)`;
          }

          const regenPerTick = Math.floor(totalCon / 3);
          const regenEl = document.getElementById("calc-regen");
          if (regenEl) {
            regenEl.textContent = `${regenPerTick} HP`;
            regenEl.title = `Total Constitution (base + items + rarity): ${totalCon} -> ${totalCon}/3 rounded down, every 2 seconds`;
          }

          const charSkill = getCharStat("char-skill");
          const meleeMult = 1 + charSkill / 50 + totalStr / 100 + totalDex / 200;
          const meleeEl = document.getElementById("calc-melee-mult");
          if (meleeEl) {
            meleeEl.textContent = `${meleeMult.toFixed(2)}x`;
            meleeEl.title = `1 + (Skill ${charSkill}/50) + (Str ${totalStr}/100) + (Dex ${totalDex}/200)`;
          }

          const maxWeight = 150 + 3 * totalStr;
          const maxWeightEl = document.getElementById("calc-max-weight");
          if (maxWeightEl) {
            maxWeightEl.textContent = maxWeight;
            maxWeightEl.title = `150 + (3 * Strength ${totalStr})`;
          }

          const bleedChance = totalStr * 0.1;
          const bleedEl = document.getElementById("calc-bleed");
          if (bleedEl) {
            const showBleed = charStr >= 100;
            if (!showBleed) {
              bleedEl.textContent = "—";
              bleedEl.title = "Requires 100+ base Strength from Character Details.";
            } else {
              bleedEl.textContent = `${bleedChance.toFixed(1)}%`;
              bleedEl.title = `0.1 * Strength ${totalStr} (base Strength from Character Details: ${charStr})`;
            }
          }

          const dexForCrit = Math.max(0, charDex - raceBonusDex); // crit uses character dex minus racial bonus
          const critChance = (dexForCrit / 2.5).toFixed(1);
          const critEl = document.getElementById("calc-crit");
          if (critEl) {
            critEl.textContent = `${critChance}%`;
            critEl.title = `Dex from Character Details minus racial bonus (${charDex} - ${raceBonusDex}) / 2.5 => ${critChance}% @ 1.35x damage`;
          }

          const drNumerator = totalDex * 0.00125;
          const dr = (drNumerator / (1 + drNumerator)) * 100;
          const drEl = document.getElementById("calc-dr");
          if (drEl) {
            drEl.textContent = `${dr.toFixed(2)}%`;
            drEl.title = `[(Total Dex ${totalDex} * 0.00125) / (1 + (Total Dex ${totalDex} * 0.00125))] * 100`;
          }

          if (quickSummaryEls.armor) quickSummaryEls.armor.textContent = totalArmor;
          if (quickSummaryEls.dps) quickSummaryEls.dps.textContent = totalDps;
          if (quickSummaryEls.weight) quickSummaryEls.weight.textContent = totalWeight;
          if (quickSummaryEls.str) quickSummaryEls.str.textContent = totalStr;
          if (quickSummaryEls.con) quickSummaryEls.con.textContent = totalCon;
          if (quickSummaryEls.dex) quickSummaryEls.dex.textContent = totalDex;
          if (quickSummaryEls.health) quickSummaryEls.health.textContent = maxHealth;
          if (quickSummaryEls.dr) quickSummaryEls.dr.textContent = `${dr.toFixed(2)}%`;
          updatePlannerStatus();
          updateSlotEditor();
        };

        const adjustRarity = (slot, delta) => {
          const data = selectedBySlot[slot];
          if (!data) return;
          const next = Math.min(Math.max(data.rarityIndex + delta, 0), data.maxRarityIndex);
          if (next === data.rarityIndex) return;
          data.rarityIndex = next;
          rollRarityBonuses(slot);
          updateSlotRarityUI(slot);
          updateTotals();
          schedulePersistState();
        };

        const adjustStat = (slot, stat, delta) => {
          const data = selectedBySlot[slot];
          if (!data || data.rarityIndex < 1) return;
          normalizeRarityBonuses(data);
          const cap = getRarityStatCap(data.rarityIndex);
          const sum = getBonusStatSum(data);
          if (delta > 0 && sum >= cap) return;

          if (stat === "str") data.bonusStr = toNumber(data.bonusStr) + delta;
          if (stat === "dex") data.bonusDex = toNumber(data.bonusDex) + delta;
          if (stat === "con") data.bonusCon = toNumber(data.bonusCon) + delta;
          normalizeRarityBonuses(data);
          updateStatAdjustUI(slot);
          updateTotals();
          schedulePersistState();
        };

        slotEls.forEach((card, slot) => {
          const inc = card.querySelector("[data-rarity-inc]");
          const dec = card.querySelector("[data-rarity-dec]");
          if (inc) inc.addEventListener("click", () => adjustRarity(slot, 1));
          if (dec) dec.addEventListener("click", () => adjustRarity(slot, -1));
          const clearBtn = card.querySelector(".slot-clear");
          if (clearBtn) clearBtn.addEventListener("click", () => clearSlot(slot));
          card.addEventListener("click", (event) => {
            if (event.target.closest("a, button, select")) return;
            if (selectedBySlot[slot]) selectSlot(slot);
          });
          card.querySelectorAll(".stat-row").forEach((row) => {
            const stat = row.dataset.stat;
            const decBtn = row.querySelector("[data-stat-dec]");
            const incBtn = row.querySelector("[data-stat-inc]");
            if (decBtn) decBtn.addEventListener("click", () => adjustStat(slot, stat, -1));
            if (incBtn) incBtn.addEventListener("click", () => adjustStat(slot, stat, 1));
          });
        });

        const buildSuggestions = (query) => {
          if (!suggestionsEl) return;
          suggestionsEl.innerHTML = "";
          clearActiveSuggestion();
          const term = String(query || "").trim().toLowerCase();
          if (!term) {
            closeSuggestions();
            return;
          }
          const matches = [...dataset.weapons, ...dataset.armors]
            .filter((item) => (item.name || "").toLowerCase().includes(term))
            .slice(0, 12);
          if (!matches.length) {
            closeSuggestions();
            return;
          }

          matches.forEach((item, idx) => {
            const div = document.createElement("div");
            div.className = "suggestion";
            div.tabIndex = -1;
            div.setAttribute("role", "option");
            div.setAttribute("aria-selected", "false");

            const title = document.createElement("div");
            title.className = "suggestion-title";
            title.textContent = item.name || "Unknown";

            const meta = document.createElement("div");
            meta.className = "suggestion-meta";
            meta.textContent = `${item.kind === "weapon" ? "Weapon" : "Armor"} \u2022 Slot: ${item.slot || "—"}`;

            div.appendChild(title);
            div.appendChild(meta);

            const handleSelect = () => {
              const targetSlot = item.slot || "Weapon";
              setSlotImage(targetSlot, item, item.kind === "weapon" ? "weapons" : "armors");
              closeSuggestions();
              searchInput.value = "";
              searchInput.focus();
              updateTotals();
            };

            div.addEventListener("click", handleSelect);
            div.addEventListener("mouseenter", () => setActiveSuggestion(idx, { focus: false }));
            div.addEventListener("focus", () => setActiveSuggestion(idx, { focus: false }));
            div.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect();
              }
            });

            suggestionsEl.appendChild(div);
          });

          suggestionsEl.style.display = "block";
        };

        const utils = window.RogueCodexUtils || {};
        const buildNameSet =
          utils.buildNameSet ||
          ((list) =>
            new Set(
              (Array.isArray(list) ? list : [])
                .map((value) => (value === null || value === undefined ? "" : String(value)).trim().toLowerCase())
                .filter(Boolean)
            ));
        const loadAllowlists =
          typeof utils.loadAllowlists === "function" ? () => utils.loadAllowlists() : () => Promise.resolve(null);
        let hiddenWeaponNames = new Set();
        let hiddenArmorNames = new Set();

        const applyAllowlists = (allowlists) => {
          hiddenWeaponNames = buildNameSet(allowlists?.weapons?.block);
          hiddenArmorNames = buildNameSet(allowlists?.armors?.block);
        };

        const loadData = () => {
          const fetchJsonCached =
            window.RogueCodexUtils?.fetchJsonCached ||
            ((targetUrl) =>
              fetch(targetUrl)
                .then((res) => (res.ok ? res.json() : []))
                .catch(() => []));
          return Promise.all([
            fetchJsonCached(new URL("../items/weapons_data05.json", window.location.href).toString()),
            fetchJsonCached(new URL("../items/armors_data06.json", window.location.href).toString()),
            fetchJsonCached(new URL("../systems/perks.json", window.location.href).toString()),
            loadAllowlists(),
          ])
            .then(([weapons, armors, perksIndex, allowlists]) => {
              applyAllowlists(allowlists);
              dataset.weapons = Array.isArray(weapons)
                ? weapons
                    .map((w) => toWeapon(w))
                    .filter((weapon) => weapon && !hiddenWeaponNames.has((weapon.name || "").toLowerCase()))
                : [];
              dataset.armors = Array.isArray(armors)
                ? armors
                    .map((a) => toArmor(a))
                    .filter((armor) => armor && !hiddenArmorNames.has((armor.name || "").toLowerCase()))
                : [];
              const perks = Array.isArray(perksIndex?.perks) ? perksIndex.perks : [];
              const seen = new Set();
              perkOptions = perks
                .filter((entry) => entry && typeof entry.name === "string")
                .filter((entry) => entry.isUnique !== true)
                .filter((entry) => entry.selectable !== false)
                .map((entry) => entry.name.trim())
                .filter(Boolean)
                .filter((name) => {
                  const key = name.toLowerCase();
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
            })
            .catch(() => {
              dataset.weapons = [];
              dataset.armors = [];
            });
        };

        const copyShareLink = async () => {
          try {
            persistStateNow();
            trackBuildEvent("build_share", getBuildParamFromSearch(window.location.search));
            await navigator.clipboard.writeText(window.location.href);
            const btn = document.getElementById("share-build");
            if (btn) {
              const original = btn.textContent;
              btn.textContent = "Copied!";
              setTimeout(() => {
                btn.textContent = original || "Share Build";
              }, 1200);
            }
          } catch (error) {
            /* ignore clipboard errors */
          }
        };

        const resetBuild = () => {
          Array.from(slotEls.keys()).forEach((slot) => clearSlot(slot));
          [
            { id: "char-level", value: "1" },
            { id: "char-str", value: "5" },
            { id: "char-dex", value: "5" },
            { id: "char-con", value: "5" },
            { id: "char-skill", value: "0" },
          ].forEach(({ id, value }) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          });
          if (raceSelect) raceSelect.value = "";
          selectSlot("");
          updateTotals();
          persistStateNow();
        };

        if (searchInput) {
          searchInput.addEventListener("input", (e) => buildSuggestions(e.target.value));
          searchInput.addEventListener("focus", () => {
            if (searchInput.value && searchInput.value.trim()) {
              buildSuggestions(searchInput.value);
            }
          });
          searchInput.addEventListener("keydown", (e) => {
            if (!suggestionsEl) return;

            if (e.key === "Escape") {
              closeSuggestions();
              return;
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (suggestionsEl.style.display === "none" && searchInput.value.trim()) {
                buildSuggestions(searchInput.value);
              }
              const items = getSuggestionItems();
              if (!items.length) return;
              const next = activeSuggestionIndex < 0 ? 0 : Math.min(activeSuggestionIndex + 1, items.length - 1);
              setActiveSuggestion(next);
              return;
            }

            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (suggestionsEl.style.display === "none" && searchInput.value.trim()) {
                buildSuggestions(searchInput.value);
              }
              const items = getSuggestionItems();
              if (!items.length) return;
              const next = activeSuggestionIndex < 0 ? items.length - 1 : Math.max(activeSuggestionIndex - 1, 0);
              setActiveSuggestion(next);
            }
          });

          if (suggestionsEl) {
            suggestionsEl.addEventListener("keydown", (e) => {
              const items = getSuggestionItems();
              if (!items.length) return;
              const currentIndex = items.indexOf(document.activeElement);
              if (currentIndex < 0) return;

              if (e.key === "Escape") {
                e.preventDefault();
                closeSuggestions();
                searchInput.focus();
                return;
              }

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveSuggestion(Math.min(currentIndex + 1, items.length - 1));
                return;
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                if (currentIndex <= 0) {
                  clearActiveSuggestion();
                  searchInput.focus();
                  return;
                }
                setActiveSuggestion(currentIndex - 1);
              }
            });
          }

          document.addEventListener("click", (e) => {
            if (!suggestionsEl.contains(e.target) && e.target !== searchInput) {
              closeSuggestions();
            }
          });
        }

        const shareBtn = document.getElementById("share-build");
        if (shareBtn) {
          shareBtn.addEventListener("click", copyShareLink);
        }
        const resetBtn = document.getElementById("reset-build");
        if (resetBtn) {
          resetBtn.addEventListener("click", resetBuild);
        }

        loadData().then(() => {
          populateRaceOptions();
          applySavedState();
          trackBuildEvent("build_view", initialBuildParam);
          persistStateNow();
          slotEls.forEach((_, slot) => updateSlotRarityUI(slot));
          updateTotals();
          wireCharacterSliders();
        });
      })();
