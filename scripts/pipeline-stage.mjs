const stage = process.argv.find((arg) => arg.startsWith("--stage="))?.slice("--stage=".length);

const stages = {
  catalogue: "Build canonical book and author catalogue.",
  download: "Download selected source texts into data/raw.",
  normalize: "Generate normalized Arabic search text while preserving original text.",
  chunk: "Build page, paragraph, logical, and evidence chunks.",
  baseline: "Run deterministic metadata extraction.",
  enrich: "Run AI-assisted enriched candidate metadata extraction.",
  validate: "Validate exact evidence spans, citations, and claim types.",
  index: "Build lexical, metadata, semantic, and graph indexes.",
  app: "Connect indexes to word analysis, PDF footnotes, and source modal."
};

if (!stage || !stages[stage]) {
  console.log("Available stages:");
  for (const [key, description] of Object.entries(stages)) {
    console.log(`- ${key}: ${description}`);
  }
  process.exit(stage ? 1 : 0);
}

console.log(`${stage}: ${stages[stage]}`);
console.log("This scaffold records the stage boundary. Implement the stage runner once the selected book scope is approved and source availability is confirmed.");
