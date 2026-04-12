const BRAZIL_STATE_DEFINITIONS = [
    { name: "Acre", aliases: ["ac"] },
    { name: "Alagoas", aliases: ["al"] },
    { name: "Amapa", aliases: ["amapa", "ap"] },
    { name: "Amazonas", aliases: ["am"] },
    { name: "Bahia", aliases: ["ba"] },
    { name: "Ceara", aliases: ["ceara", "ce"] },
    { name: "Distrito Federal", aliases: ["df", "brasilia"] },
    { name: "Espirito Santo", aliases: ["espirito santo", "es", "espirito-santo"] },
    { name: "Goias", aliases: ["goias", "go"] },
    { name: "Maranhao", aliases: ["maranhao", "ma"] },
    { name: "Mato Grosso", aliases: ["mt"] },
    { name: "Mato Grosso do Sul", aliases: ["ms"] },
    { name: "Minas Gerais", aliases: ["mg"] },
    { name: "Para", aliases: ["para", "pa"] },
    { name: "Paraiba", aliases: ["paraiba", "pb"] },
    { name: "Parana", aliases: ["parana", "pr"] },
    { name: "Pernambuco", aliases: ["pe"] },
    { name: "Piaui", aliases: ["piaui", "pi"] },
    { name: "Rio de Janeiro", aliases: ["rj"] },
    { name: "Rio Grande do Norte", aliases: ["rn"] },
    { name: "Rio Grande do Sul", aliases: ["rs"] },
    { name: "Rondonia", aliases: ["rondonia", "ro"] },
    { name: "Roraima", aliases: ["rr"] },
    { name: "Santa Catarina", aliases: ["sc"] },
    { name: "Sao Paulo", aliases: ["sao paulo", "sp"] },
    { name: "Sergipe", aliases: ["se"] },
    { name: "Tocantins", aliases: ["to"] }
];
function normalizeWeatherText(value = "") {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeWeatherLookupKey(value = "") {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9,\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function detectBrazilStateDefinition(value = "") {
    const normalized = normalizeWeatherLookupKey(value)
        .replace(/\b(?:estado|cidade|municipio|pais|regiao|localidade)\b/g, " ")
        .replace(/\b(?:de|da|do|dos|das)\b/g, " ")
        .replace(/\b(?:brasil|brazil)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized)
        return null;
    return BRAZIL_STATE_DEFINITIONS.find((entry) => {
        const aliases = [entry.name, ...(entry.aliases || [])]
            .map((alias) => normalizeWeatherLookupKey(alias))
            .filter(Boolean);
        return aliases.includes(normalized);
    }) || null;
}
function isAmbiguousBrazilStateName(entry = null) {
    const normalizedName = normalizeWeatherLookupKey(entry?.name || "");
    return normalizedName === "sao paulo" || normalizedName === "rio de janeiro";
}
function questionExplicitlyRequestsState(question = "") {
    return /\b(estado|uf)\b/.test(normalizeWeatherLookupKey(question));
}
function detectWeatherLocationScope(question = "", query = "") {
    const normalizedQuestion = normalizeWeatherLookupKey(question);
    const normalizedQuery = normalizeWeatherLookupKey(query);
    if (/\b(pais|country|nacao)\b/.test(normalizedQuestion))
        return "country";
    if (/\b(estado|uf)\b/.test(normalizedQuestion))
        return "state";
    if (/\b(cidade|municipio|capital)\b/.test(normalizedQuestion))
        return "city";
    const stateDefinition = detectBrazilStateDefinition(normalizedQuery);
    if (stateDefinition && (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question)))
        return "state";
    if (/^(brasil|brazil)$/.test(normalizedQuery))
        return "country";
    return "place";
}
function classifyWeatherLocationResult(result = {}) {
    const featureCode = normalizeWeatherLookupKey(result?.feature_code || result?.featureCode || "");
    if (/^(bay|gulf|sea|ocean|strait|channel|fjord|reef|shoal|lagoon|lake|reservoir|peninsula|cape|hill|mountain|peak|valley|plain|forest|desert|island|isthmus|waterfall|stream|river)$/.test(featureCode))
        return "natural_feature";
    if (/^adm1$/.test(featureCode))
        return "state";
    if (/^adm2$/.test(featureCode))
        return "municipality";
    if (/^pcl/.test(featureCode))
        return "country";
    if (/^ppl/.test(featureCode))
        return "city";
    const name = normalizeWeatherLookupKey(result?.name || "");
    const admin1 = normalizeWeatherLookupKey(result?.admin1 || "");
    const country = normalizeWeatherLookupKey(result?.country || "");
    if (name && admin1 && name === admin1)
        return "state";
    if (name && country && name === country)
        return "country";
    if (name && admin1)
        return "city";
    if (name && !admin1 && country)
        return "place";
    return "place";
}
function buildWeatherLookupParts(query = "") {
    return String(query || "")
        .split(",")
        .map((entry) => normalizeWeatherLookupKey(entry))
        .filter(Boolean);
}
function refineWeatherLocationCandidate(value = "") {
    const input = String(value || "").trim();
    if (!input) {
        return "";
    }
    const trailingLocationMatch = input.match(/(?:^|.*\b)(?:em|na|no|para)\s+([a-zà-ú0-9'.\s,-]{2,80})$/i);
    if (trailingLocationMatch?.[1]) {
        return String(trailingLocationMatch[1] || "").trim();
    }
    return input;
}
export function sanitizeWeatherLocationQuery(value = "") {
    const cleaned = normalizeWeatherText(value)
        .replace(/[?!.,;:]+$/g, "")
        .replace(/\b(?:hoje|agora|amanha|depois de amanha|esta semana|essa semana|semana|proximos dias|previsao semanal|clima|tempo|temperatura|chuva|uv|vento|momento)\b/g, " ")
        .replace(/\b(?:estado|cidade|municipio|pais|regiao|localidade)\s+(?:de|da|do|dos|das)\b/g, " ")
        .replace(/\b(?:estado|cidade|municipio|pais|regiao|localidade)\b/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .replace(/,\s*,+/g, ", ")
        .replace(/\s{2,}/g, " ")
        .replace(/^(?:\s*(?:em|de|para|na|no)\s+)+/g, "")
        .replace(/^[\s,/-]+|[\s,/-]+$/g, "")
        .trim();
    const refined = refineWeatherLocationCandidate(cleaned);
    if (!refined || refined.split(/\s+/).length > 6)
        return "";
    if (/^(hoje|agora|amanha|semana|tempo real|localizacao|minha cidade|momento|aqui)$/.test(refined))
        return "";
    return refined;
}
export function buildWeatherGeocodingSearchQuery(query = "", question = "") {
    const sanitizedQuery = sanitizeWeatherLocationQuery(query)
        .replace(/\s*,\s*/g, ", ")
        .replace(/,\s*,+/g, ", ")
        .replace(/\s+brasil$/i, ", Brasil")
        .replace(/,\s+Brasil$/i, ", Brasil")
        .replace(/^,\s*/g, "")
        .trim();
    const scopeHint = detectWeatherLocationScope(question, sanitizedQuery);
    const stateDefinition = detectBrazilStateDefinition(sanitizedQuery);
    const normalizedQuery = normalizeWeatherLookupKey(sanitizedQuery);
    if (stateDefinition && (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question))) {
        return `${stateDefinition.name}, Brasil`;
    }
    if (normalizedQuery.endsWith(" brasil")) {
        return sanitizedQuery.replace(/\s+brasil$/i, ", Brasil");
    }
    if (scopeHint === "country" && /^(brasil|brazil)$/i.test(sanitizedQuery)) {
        return "Brasil";
    }
    return sanitizedQuery;
}
export function shouldRestrictWeatherLookupToBrazil(query = "", question = "") {
    const normalizedQuery = normalizeWeatherLookupKey(query);
    if (/\b(brasil|brazil)\b/.test(normalizedQuery))
        return true;
    const stateDefinition = detectBrazilStateDefinition(query);
    if (stateDefinition && (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question)))
        return true;
    return false;
}
function matchesBrazilStateCandidate(result = {}, stateDefinition = null) {
    if (!stateDefinition)
        return false;
    const resultType = classifyWeatherLocationResult(result);
    const stateName = normalizeWeatherLookupKey(stateDefinition.name);
    const name = normalizeWeatherLookupKey(result?.name || "");
    const admin1 = normalizeWeatherLookupKey(result?.admin1 || "");
    const countryCode = normalizeWeatherLookupKey(result?.country_code || "");
    return resultType === "state" && countryCode === "br" && (name === stateName || admin1 === stateName);
}
function buildWeatherLocationLabel(result = {}) {
    const name = String(result?.name || "").trim();
    const admin1 = String(result?.admin1 || "").trim();
    const country = String(result?.country || result?.country_code || "").trim();
    const normalizedName = normalizeWeatherLookupKey(name);
    const normalizedAdmin1 = normalizeWeatherLookupKey(admin1);
    if (!name)
        return [admin1, country].filter(Boolean).join(", ").trim();
    if (admin1 && normalizedAdmin1 && normalizedAdmin1 !== normalizedName)
        return [name, admin1].filter(Boolean).join(", ").trim();
    return [name, country].filter(Boolean).join(", ").trim();
}
function buildWeatherLocationDisplayLabel(result = {}, query = "", question = "") {
    const locationType = classifyWeatherLocationResult(result);
    const stateDefinition = detectBrazilStateDefinition(query);
    const name = String(result?.name || "").trim();
    const admin1 = String(result?.admin1 || "").trim();
    const country = String(result?.country || result?.country_code || "").trim();
    if (locationType === "state" && stateDefinition && matchesBrazilStateCandidate(result, stateDefinition)) {
        return [`Estado: ${stateDefinition.name}`, country || "Brasil"].filter(Boolean).join(", ").trim();
    }
    if (locationType === "city" || locationType === "municipality") {
        return [`Cidade: ${name}`, admin1 || country].filter(Boolean).join(", ").trim();
    }
    if (locationType === "country" && name)
        return `Pais: ${name}`;
    return buildWeatherLocationLabel(result) || sanitizeWeatherLocationQuery(query);
}
function scoreWeatherLocationCandidate(result = {}, { query = "", question = "" } = {}) {
    const normalizedQuery = normalizeWeatherLookupKey(query);
    const scopeHint = detectWeatherLocationScope(question, query);
    const stateDefinition = detectBrazilStateDefinition(query);
    const resultType = classifyWeatherLocationResult(result);
    const name = normalizeWeatherLookupKey(result?.name || "");
    const admin1 = normalizeWeatherLookupKey(result?.admin1 || "");
    const country = normalizeWeatherLookupKey(result?.country || "");
    const countryCode = normalizeWeatherLookupKey(result?.country_code || "");
    const queryParts = buildWeatherLookupParts(query);
    let score = 0;
    if (resultType === "natural_feature")
        score -= 260;
    if (name && name === normalizedQuery)
        score += 120;
    if (admin1 && admin1 === normalizedQuery)
        score += 118;
    if (country && country === normalizedQuery)
        score += 118;
    if (name && normalizedQuery && name.includes(normalizedQuery))
        score += 24;
    if (admin1 && normalizedQuery && admin1.includes(normalizedQuery))
        score += 20;
    if (country && normalizedQuery && country.includes(normalizedQuery))
        score += 12;
    if (queryParts.length >= 2) {
        const [primary, secondary] = queryParts;
        if (primary && (name === primary || admin1 === primary))
            score += 36;
        if (secondary && (admin1 === secondary || country === secondary || countryCode === secondary))
            score += 28;
        if (primary && secondary && name === primary && country === secondary)
            score += 18;
    }
    if (scopeHint === "state" && resultType === "state")
        score += 100;
    if (scopeHint === "state" && resultType !== "state")
        score -= 120;
    if (scopeHint === "country" && resultType === "country")
        score += 100;
    if (scopeHint === "country" && resultType !== "country")
        score -= 120;
    if (scopeHint === "city" && (resultType === "city" || resultType === "municipality"))
        score += 82;
    if (scopeHint === "city" && !["city", "municipality"].includes(resultType))
        score -= 80;
    if (scopeHint === "place" && resultType === "city")
        score += 18;
    if (stateDefinition &&
        (!isAmbiguousBrazilStateName(stateDefinition) || questionExplicitlyRequestsState(question)) &&
        countryCode === "br" &&
        (name === normalizeWeatherLookupKey(stateDefinition.name) || admin1 === normalizeWeatherLookupKey(stateDefinition.name))) {
        score += 130;
    }
    if (/\bbrasil\b/.test(String(query || "").toLowerCase()) && countryCode === "br")
        score += 16;
    if (stateDefinition && resultType === "natural_feature")
        score -= 180;
    const latitude = Number(result?.latitude);
    const longitude = Number(result?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude))
        score += 4;
    return score;
}
export function selectPreferredWeatherLocationResult(results = [], { query = "", question = "" } = {}) {
    const validResults = Array.isArray(results)
        ? results.filter((entry) => Number.isFinite(Number(entry?.latitude)) && Number.isFinite(Number(entry?.longitude)))
        : [];
    if (!validResults.length)
        return null;
    const scopeHint = detectWeatherLocationScope(question, query);
    const stateDefinition = detectBrazilStateDefinition(query);
    if (scopeHint === "state" && stateDefinition) {
        const stateMatches = validResults.filter((entry) => matchesBrazilStateCandidate(entry, stateDefinition));
        if (stateMatches.length) {
            return stateMatches
                .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
                .sort((left, right) => right.score - left.score)[0]?.entry || null;
        }
    }
    if (scopeHint === "country") {
        const countryMatches = validResults.filter((entry) => classifyWeatherLocationResult(entry) === "country");
        if (countryMatches.length) {
            return countryMatches
                .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
                .sort((left, right) => right.score - left.score)[0]?.entry || null;
        }
    }
    if (scopeHint === "city") {
        const cityMatches = validResults.filter((entry) => {
            const locationType = classifyWeatherLocationResult(entry);
            return locationType === "city" || locationType === "municipality";
        });
        if (cityMatches.length) {
            return cityMatches
                .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
                .sort((left, right) => right.score - left.score)[0]?.entry || null;
        }
    }
    return validResults
        .map((entry) => ({ entry, score: scoreWeatherLocationCandidate(entry, { query, question }) }))
        .sort((left, right) => right.score - left.score)[0]?.entry || null;
}
export function buildResolvedWeatherLocation(result = {}, query = "", forecastDays = 7, question = "") {
    const latitude = Number(result.latitude);
    const longitude = Number(result.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        return null;
    const locationType = classifyWeatherLocationResult(result);
    return {
        label: buildWeatherLocationDisplayLabel(result, query, question) || sanitizeWeatherLocationQuery(query),
        latitude,
        longitude,
        forecastDays: Math.max(1, Math.min(Number(forecastDays || 7) || 7, 7)),
        timezone: String(result.timezone || "auto"),
        city: String(result.name || "").trim(),
        region: String(result.admin1 || "").trim(),
        country: String(result.country || "").trim(),
        countryCode: String(result.country_code || "").trim(),
        sourceType: "named_query",
        locationType,
        requestedQuery: sanitizeWeatherLocationQuery(query)
    };
}
