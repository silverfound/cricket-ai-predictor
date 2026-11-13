const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync("script.js", "utf8");
const start = source.indexOf("function getMatchResultText(");
const end = source.indexOf("\n\n// ==========================================\n// NAME MAPPING", start);
if (start < 0 || end < 0) throw new Error("match result helpers not found");
const aliasesJson = JSON.stringify(JSON.parse(fs.readFileSync("data/team_aliases.json", "utf8")).aliases);
const sandbox = {};
sandbox.__source = source.slice(start, end) + `
const __aliases = ${aliasesJson};
cricketTeamAliasIndex = Object.fromEntries(Object.entries(__aliases).map(([alias, canonical]) => [normalizeCricketTeamName(alias), cleanCricketTeamLabel(canonical)]));
this.classifyMatchStatus = classifyMatchStatus;
this.getMatchResultText = getMatchResultText;
this.resultWinnerMatchesTeam = resultWinnerMatchesTeam;
this.canonicalCricketTeamName = canonicalCricketTeamName;
this.cricketTeamNamesEquivalent = cricketTeamNamesEquivalent;
`;
vm.runInNewContext(sandbox.__source, sandbox);
const now = 1_800_000_000;
const result = "S Paschim won by 7 runs";
const fixture = { match_id: "54551317", teama: { name: "Kathmandu Gurkhas (NPL)" }, teamb: { name: "Sudur Paschim Royals (NPL)" }, status_note: result, timestamp_start: now - 3600 };
if (sandbox.classifyMatchStatus(fixture, now) !== "finished") throw new Error("result in status_note must classify as Finished");
if (!sandbox.resultWinnerMatchesTeam(result, "Sudur Paschim Royals (NPL)", fixture.teama.name, fixture.teamb.name)) throw new Error("S Paschim must match Sudur Paschim Royals");
if (!sandbox.resultWinnerMatchesTeam("Finished | S Paschim won by 7 runs", "Sudur Paschim Royals (NPL)", fixture.teama.name, fixture.teamb.name)) throw new Error("generic Finished prefix must not hide winner");
if (!sandbox.resultWinnerMatchesTeam("Sudur Paschim won by 7 runs", "S Paschim", fixture.teama.name, fixture.teamb.name)) throw new Error("abbreviated prediction must match canonical team");
if (sandbox.getMatchResultText({status:"Finished", status_str:"S Paschim won by 7 runs"}) !== "S Paschim won by 7 runs") throw new Error("generic status must not be prepended to result");
if (sandbox.resultWinnerMatchesTeam(result, "Kathmandu Gurkhas (NPL)", fixture.teama.name, fixture.teamb.name)) throw new Error("losing team must not be marked correct");
if (sandbox.getMatchResultText({ status: "Kathmandu Gurkhas lost; S Paschim won by 7 runs" }) === "") throw new Error("result text must be read from status");
const activeT10 = {
    match_id: "54644347", status: "Finished", match_started: true,
    timestamp_start: now - 600, teama: {name:"Royal Desert Champions"},
    teamb: {name:"Yas Lions"}
};
if (sandbox.classifyMatchStatus(activeT10, now) !== "live") throw new Error("generic Finished label must not hide an active T10 match");
const upcomingT10 = {
    match_id: "54644347", status: "Finished", match_started: false,
    timestamp_start: now + 600, teama: {name:"Royal Desert Champions"},
    teamb: {name:"Yas Lions"}
};
if (sandbox.classifyMatchStatus(upcomingT10, now) !== "upcoming") throw new Error("generic Finished label must not finish a future fixture");
if (!sandbox.resultWinnerMatchesTeam("Tigers won by 24 runs", "United Tigers", "Emirates Eagles", "United Tigers")) throw new Error("Tigers provider alias must match United Tigers");
if (sandbox.resultWinnerMatchesTeam("Tigers won by 24 runs", "Emirates Eagles", "Emirates Eagles", "United Tigers")) throw new Error("winner alias must not mark losing team correct");
if (sandbox.resultWinnerMatchesTeam("Tigers won by 24 runs", "United Tigers", "Desert Tigers", "United Tigers")) throw new Error("ambiguous one-word team alias must not be accepted");
if (sandbox.resultWinnerMatchesTeam("Tigers won by 24 runs", "United Tigers", "United Tigers", "Tigers XI")) throw new Error("alias appearing anywhere in opponent name must be treated as ambiguous");

if (sandbox.canonicalCricketTeamName("Sudur Paschim Royals (NPL)") !== "Sudur Paschim Royals") throw new Error("competition suffix must not block canonical team lookup");
if (sandbox.canonicalCricketTeamName("S. Paschim") !== "Sudur Paschim Royals") throw new Error("known short provider alias must resolve to canonical team");
if (sandbox.canonicalCricketTeamName("Auckland Hearts") !== "Auckland Women") throw new Error("women franchise alias must resolve to women's model team");
if (!sandbox.cricketTeamNamesEquivalent("Melbourne Stars (W)", "Melbourne Stars Women")) throw new Error("(W) and Women labels must identify the same women's team");
if (sandbox.cricketTeamNamesEquivalent("Melbourne Stars", "Melbourne Stars Women")) throw new Error("men's and women's teams must never be treated as identical");
if (sandbox.cricketTeamNamesEquivalent("Team A", "Team Alpha")) throw new Error("single-letter prefix must not create a false team match");

process.stdout.write("PASS result note classifies as Finished\nPASS S Paschim alias matches Sudur Paschim Royals prediction\nPASS losing team remains incorrect\nPASS result can be read from status field\n");