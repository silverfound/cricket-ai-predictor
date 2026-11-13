const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync("script.js", "utf8");
const match = source.match(/function classifyMatchStatus[\\s\\S]*?\\n}/);
if (!match) throw new Error("classifyMatchStatus helper not found");
const sandbox = {};
vm.runInNewContext(match[0] + "\\nthis.classifyMatchStatus = classifyMatchStatus;", sandbox);
const classify = sandbox.classifyMatchStatus;
const now = 1_800_000_000;
const future = now + 3600;
const past = now - 3600;
const cases = [
  ["future fixture without status is Upcoming", { timestamp_start: future }, "upcoming"],
  ["provider ended flag overrides stale live text", { status: "Live", match_ended: true, timestamp_start: future }, "finished"],
  ["provider started flag identifies Live", { status: "Scheduled", match_started: true, timestamp_start: future }, "live"],
  ["innings completed is not match finished", { status: "Innings completed", timestamp_start: past }, "live"],
  ["match result is Finished", { status: "Match completed", timestamp_start: past }, "finished"],
  ["old scheduled record is not Upcoming", { status: "Scheduled", timestamp_start: past }, "unknown"],
  ["nested CricketData ended flag is honored", { status: "In progress", provider_metadata: { matchEnded: "true" } }, "finished"]
];
for (const [name, fixture, expected] of cases) {
  const actual = classify(fixture, now);
  if (actual !== expected) throw new Error(name + ": expected " + expected + ", got " + actual);
  process.stdout.write("PASS " + name + "\\n");
}
