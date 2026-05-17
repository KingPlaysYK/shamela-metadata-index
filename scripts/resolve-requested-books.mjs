import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requestedPath = path.join(root, "config", "requested-book-batches.json");
const sourceCsv = path.join(root, "data", "existing-app-rag-data", "sources", "shamela_books_info.csv");
const reportsDir = path.join(root, "reports");

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (quoted && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function normalizeArabic(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const authorAliases = {
  "Ibn al-Jawzi": ["ابن الجوزي", "الجوزي"],
  "Ibn Hajar al-Asqalani": ["ابن حجر", "العسقلاني", "أحمد بن علي بن حجر"],
  "Ibn Qudamah al-Maqdisi": ["ابن قدامة", "المقدسي", "موفق الدين ابن قدامة"],
  "al-Dhahabi": ["الذهبي", "شمس الدين الذهبي"],
  "Ibn Qayyim al-Jawziyyah": ["ابن القيم", "ابن قيم", "الجوزية", "محمد بن أبي بكر"],
  "Muhammad Nasir al-Din al-Albani": ["الألباني", "ناصر الدين الألباني", "محمد ناصر الدين"],
  "Muhammad ibn Salih al-Uthaymin": ["ابن عثيمين", "العثيمين", "محمد بن صالح العثيمين"],
  "al-Qurtubi": ["القرطبي", "محمد بن أحمد القرطبي"],
  "Ibn Rushd": ["ابن رشد", "الحفيد"],
  "Qadi Iyad": ["القاضي عياض", "عياض"],
  "Ibn Hazm": ["ابن حزم", "علي بن أحمد بن حزم"],
  "Muhammad ibn Ali al-Ithyubi": ["الأثيوبي", "محمد بن علي بن آدم"],
  "al-Baghawi": ["البغوي", "الحسين بن مسعود"],
  "al-Shafi'i": ["الشافعي", "محمد بن إدريس"],
  "Ibn Rushd al-Jadd / Maliki tradition": ["ابن رشد", "الجد", "أبو الوليد"],
  "Ala al-Din al-Kasani": ["الكاساني", "علاء الدين الكاساني", "أبو بكر بن مسعود"],
  "Ibn Kathir": ["ابن كثير", "إسماعيل بن عمر"],
  "al-Nawawi": ["النووي", "يحيى بن شرف"],
  "al-Tabari": ["الطبري", "ابن جرير", "محمد بن جرير"],
  "Ibn al-Athir": ["ابن الأثير", "علي بن محمد بن عبد الكريم"],
  "Ibn Khaldun": ["ابن خلدون", "عبد الرحمن بن محمد"],
  "Badr al-Din al-Ayni": ["العيني", "بدر الدين العيني", "محمود بن أحمد"],
  "Ibn Abd al-Barr": ["ابن عبد البر", "يوسف بن عبد الله"],
  "Ibn Abd Rabbih": ["ابن عبد ربه", "أحمد بن محمد بن عبد ربه"],
  "al-Bayhaqi": ["البيهقي", "أحمد بن الحسين البيهقي"],
  "Abu Layth al-Samarqandi": ["السمرقندي", "أبو الليث", "نصر بن محمد"],
  "Ibn Muflih": ["ابن مفلح", "محمد بن مفلح"],
  "al-Khatib al-Baghdadi": ["الخطيب البغدادي", "أحمد بن علي البغدادي"],
  "al-Zarkashi": ["الزركشي", "بدر الدين الزركشي", "محمد بن بهادر"],
  "Ibn Hajar al-Asqalani / al-Kashshaf takhrij": ["ابن حجر", "العسقلاني"],
  "al-Baydawi": ["البيضاوي", "ناصر الدين البيضاوي"],
  "al-Mawsuah al-Fiqhiyyah al-Kuwaitiyyah": ["وزارة الأوقاف الكويتية", "الموسوعة الفقهية الكويتية"],
  "multiple": ["اللغة", "النحو", "الصرف", "البلاغة", "المعاجم", "الغريب", "العروض", "الأمثال"]
};

const titleAliasesById = {
  "035": ["بداية المجتهد", "بداية المجتهد ونهاية المقتصد"],
  "037": ["المحلى", "المحلى بالآثار"],
  "038": ["البحر المحيط الثجاج", "البحر المحيط الثجاج في شرح صحيح الإمام مسلم بن الحجاج"],
  "039": ["شرح السنة"],
  "040": ["الأم"],
  "041": ["البيان والتحصيل"],
  "042": ["بدائع الصنائع", "بدائع الصنائع في ترتيب الشرائع"],
  "045": ["تاريخ الطبري", "تاريخ الرسل والملوك"],
  "046": ["الكامل في التاريخ"],
  "047": ["العبر", "كتاب العبر", "ديوان المبتدأ والخبر"],
  "048": ["عمدة القاري", "عمدة القاري شرح صحيح البخاري"],
  "050": ["العقد الفريد"],
  "053": ["شعب الإيمان", "الجامع لشعب الإيمان"],
  "054": ["تنبيه الغافلين"],
  "055": ["الآداب الشرعية", "الآداب الشرعية والمنح المرعية"],
  "056": ["تاريخ بغداد", "تاريخ مدينة السلام"],
  "057": ["البرهان في علوم القرآن"],
  "058": ["تخريج أحاديث الكشاف", "الكافي الشاف في تخريج أحاديث الكشاف"],
  "059": ["أنوار التنزيل", "أنوار التنزيل وأسرار التأويل"],
  "060": ["الموسوعة الفقهية الكويتية"]
};

const requiredEditionTermsById = {
  "050": ["أحمد أمين", "أحمد الزين", "إبراهيم الأبياري"]
};

function rowSearchText(row) {
  return normalizeArabic([
    row.book_title,
    row.author_name,
    row.nickname,
    row.category,
    row.editor,
    row.publisher,
    row.edition
  ].join(" "));
}

function scoreRow(row, item, authorPatterns, titlePatterns) {
  const reasons = [];
  const normalizedBookTitle = normalizeArabic(row.book_title);
  const normalizedAuthor = normalizeArabic([row.author_name, row.nickname].join(" "));
  const normalizedFullRow = row.search_text;
  let score = 0;

  for (const pattern of titlePatterns) {
    if (!pattern) continue;
    if (normalizedBookTitle === pattern) {
      score += 100;
      reasons.push(`exact title: ${pattern}`);
    } else if (normalizedBookTitle.includes(pattern)) {
      score += 70;
      reasons.push(`title contains: ${pattern}`);
    } else if (normalizedFullRow.includes(pattern)) {
      score += 25;
      reasons.push(`record contains title term: ${pattern}`);
    }
  }

  for (const pattern of authorPatterns) {
    if (!pattern) continue;
    if (normalizedAuthor.includes(pattern)) {
      score += 35;
      reasons.push(`author contains: ${pattern}`);
    } else if (normalizedFullRow.includes(pattern)) {
      score += 10;
      reasons.push(`record contains author term: ${pattern}`);
    }
  }

  const normalizedTitle = normalizeArabic(item.title);
  const titleTokens = normalizedTitle.split(" ").filter((part) => part.length > 3);
  for (const token of titleTokens) {
    if (normalizedBookTitle.includes(token)) score += 2;
  }

  if (item.scope === "single_work" && titlePatterns.length && score > 0) score += 5;
  if (item.scope === "author_collection" && authorPatterns.some((pattern) => normalizedAuthor.includes(pattern))) score += 10;

  return { score, reasons };
}

function editionStatus(item, candidate) {
  const terms = requiredEditionTermsById[item.id];
  if (!terms?.length || !candidate) return "not_required";
  const haystack = normalizeArabic([
    candidate.editor,
    candidate.publisher,
    candidate.edition,
    candidate.title_ar
  ].join(" "));
  const missing = terms.filter((term) => !haystack.includes(normalizeArabic(term)));
  return missing.length ? `missing required edition terms: ${missing.join("، ")}` : "matched_required_terms";
}

const requested = JSON.parse((await fs.readFile(requestedPath, "utf8")).replace(/^\uFEFF/, ""));
const csv = await fs.readFile(sourceCsv, "utf8");
const [headerLine, ...dataLines] = csv.split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(headerLine);

const rows = dataLines.map((line) => {
  const cells = parseCsvLine(line);
  const row = {};
  headers.forEach((header, index) => {
    row[header] = cells[index] || "";
  });
  row.search_text = rowSearchText(row);
  return row;
});

const resolved = requested.map((item) => {
  const authorPatterns = (authorAliases[item.author] || [item.author])
    .map(normalizeArabic)
    .filter(Boolean);
  const titlePatterns = (titleAliasesById[item.id] || [])
    .map(normalizeArabic)
    .filter(Boolean);

  const candidates = rows
    .map((row) => {
      const scored = scoreRow(row, item, authorPatterns, titlePatterns);
      return { row, ...scored };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.row.book_id || 0) - Number(b.row.book_id || 0))
    .map(({ row, score, reasons }) => ({
      score,
      reasons,
      book_id: row.book_id,
      title_ar: row.book_title,
      author_ar: row.author_name,
      author_death_h: row.author_year,
      category: row.category,
      pages: row.pages,
      volumes: row.volumes,
      edition: row.edition,
      publisher: row.publisher,
      editor: row.editor,
      link: row.book_link
    }));

  const top = candidates[0] || null;
  return {
    ...item,
    candidate_count: candidates.length,
    edition_status: editionStatus(item, top),
    top_candidates: candidates.slice(0, 25),
    candidates: candidates.slice(0, 300)
  };
});

await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(reportsDir, "requested-book-resolution.json"), JSON.stringify(resolved, null, 2), "utf8");

const md = [
  "# Requested Book Resolution",
  "",
  "This report resolves the requested book scopes against the available Shamela book-info catalogue copied from the app.",
  "Candidate matches are not final download decisions. They must be reviewed to choose the most complete, least abridged, best-provenance edition.",
  "",
  "| ID | Request | Candidates | Edition status | Top matches |",
  "|---|---|---:|---|---|",
  ...resolved.map((item) => {
    const top = item.top_candidates
      .slice(0, 3)
      .map((candidate) => `${escapeMd(candidate.title_ar)} (${candidate.book_id}, score ${candidate.score})`)
      .join("<br>");
    return `| ${item.id} | ${escapeMd(item.title)} | ${item.candidate_count} | ${escapeMd(item.edition_status)} | ${top || "None found"} |`;
  }),
  "",
  "Full candidate lists are stored in `reports/requested-book-resolution.json`.",
  ""
];

await fs.writeFile(path.join(reportsDir, "requested-book-resolution.md"), md.join("\n"), "utf8");

console.log(`Resolved ${resolved.length} requested scopes against ${rows.length} catalogue rows.`);
