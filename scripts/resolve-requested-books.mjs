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
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
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
    .trim();
}

const aliases = {
  "Ibn al-Jawzi": ["ابن الجوزي", "الجوزي"],
  "Ibn Hajar al-Asqalani": ["ابن حجر", "العسقلاني"],
  "Ibn Qudamah al-Maqdisi": ["ابن قدامة", "المقدسي"],
  "al-Dhahabi": ["الذهبي"],
  "Ibn Qayyim al-Jawziyyah": ["ابن القيم", "ابن قيم", "الجوزية"],
  "Muhammad Nasir al-Din al-Albani": ["الألباني", "ناصر الدين الألباني"],
  "Muhammad ibn Salih al-Uthaymin": ["ابن عثيمين", "العثيمين"],
  "al-Qurtubi": ["القرطبي"],
  "Ibn Rushd": ["بداية المجتهد", "ابن رشد"],
  "Qadi Iyad": ["القاضي عياض", "عياض"],
  "Ibn Hazm": ["المحلى", "ابن حزم"],
  "Muhammad ibn Ali al-Ithyubi": ["الأثيوبي", "البحر المحيط الثجاج"],
  "al-Baghawi": ["شرح السنة", "البغوي"],
  "al-Shafi'i": ["الأم", "الشافعي"],
  "Ibn Rushd al-Jadd / Maliki tradition": ["البيان والتحصيل", "ابن رشد"],
  "Ala al-Din al-Kasani": ["بدائع الصنائع", "الكاساني"],
  "Ibn Kathir": ["ابن كثير"],
  "al-Nawawi": ["النووي"],
  "al-Tabari": ["تاريخ الطبري", "تاريخ الرسل والملوك", "الطبري"],
  "Ibn al-Athir": ["الكامل في التاريخ", "ابن الأثير"],
  "Ibn Khaldun": ["ابن خلدون", "العبر"],
  "Badr al-Din al-Ayni": ["عمدة القاري", "العيني"],
  "Ibn Abd al-Barr": ["ابن عبد البر"],
  "Ibn Abd Rabbih": ["العقد الفريد", "ابن عبد ربه", "أحمد أمين", "أحمد الزين", "إبراهيم الأبياري", "علي أحمد زين", "لجنة التأليف والترجمة والنشر"],
  "al-Bayhaqi": ["شعب الإيمان", "البيهقي"],
  "Abu Layth al-Samarqandi": ["تنبيه الغافلين", "السمرقندي"],
  "Ibn Muflih": ["الآداب الشرعية", "ابن مفلح"],
  "al-Khatib al-Baghdadi": ["تاريخ بغداد", "الخطيب البغدادي"],
  "al-Zarkashi": ["البرهان في علوم القرآن", "الزركشي"],
  "Ibn Hajar al-Asqalani / al-Kashshaf takhrij": ["تخريج أحاديث الكشاف", "الكشاف", "ابن حجر"],
  "al-Baydawi": ["أنوار التنزيل", "البيضاوي"],
  "al-Mawsuah al-Fiqhiyyah al-Kuwaitiyyah": ["الموسوعة الفقهية الكويتية", "وزارة الأوقاف الكويتية"],
  "multiple": ["اللغة", "النحو", "الصرف", "البلاغة", "المعاجم", "الغريب", "العروض", "الأمثال"]
};

function rowSearchText(row) {
  return normalizeArabic([
    row.book_title,
    row.author_name,
    row.nickname,
    row.category,
    row.editor,
    row.publisher
  ].join(" "));
}

function scoreRow(row, item, patterns) {
  const text = row.search_text;
  let score = 0;

  for (const pattern of patterns) {
    if (pattern && text.includes(pattern)) score += 5;
  }

  const normalizedTitle = normalizeArabic(item.title);
  for (const token of normalizedTitle.split(" ").filter((part) => part.length > 2)) {
    if (text.includes(token)) score += 1;
  }

  if (item.scope === "single_work" && score > 0) score += 2;
  if (row.book_title && normalizeArabic(row.book_title).includes(normalizedTitle)) score += 10;
  return score;
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
  const patterns = (aliases[item.author] || [item.author, item.title])
    .map(normalizeArabic)
    .filter(Boolean);

  const candidates = rows
    .map((row) => ({ row, score: scoreRow(row, item, patterns) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.row.book_id || 0) - Number(b.row.book_id || 0))
    .map(({ row, score }) => ({
      score,
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

  return {
    ...item,
    candidate_count: candidates.length,
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
  "| ID | Request | Candidates | Top matches |",
  "|---|---|---:|---|",
  ...resolved.map((item) => {
    const top = item.top_candidates
      .slice(0, 3)
      .map((candidate) => `${candidate.title_ar} (${candidate.book_id})`)
      .join("<br>");
    return `| ${item.id} | ${item.title} | ${item.candidate_count} | ${top || "None found"} |`;
  }),
  "",
  "Full candidate lists are stored in `reports/requested-book-resolution.json`.",
  ""
];

await fs.writeFile(path.join(reportsDir, "requested-book-resolution.md"), md.join("\n"), "utf8");

console.log(`Resolved ${resolved.length} requested scopes against ${rows.length} catalogue rows.`);
