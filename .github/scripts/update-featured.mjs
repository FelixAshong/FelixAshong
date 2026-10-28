// Rewrites the Featured Projects cards in README.md with the four most recently
// pushed repos (public and private, no forks, no archived, not this repo).
// Cards are drawn as SVGs in assets/featured/ because the public card services
// can't see private repos. Private cards link to the repo's website if it has one.
// Token: GH_TOKEN (Actions secret) or the local `gh auth token`.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER = "FelixAshong";
const COUNT = 4;
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const token = process.env.GH_TOKEN || execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();

const query = `{
  viewer {
    login
    repositories(first: 30, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes { name description url homepageUrl isPrivate isArchived pushedAt primaryLanguage { name color } }
    }
  }
}`;
const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const { data, errors } = await res.json();
if (!res.ok || errors || !data) throw new Error(`GitHub API ${res.status}: ${JSON.stringify(errors ?? data)}`);
if (data.viewer.login !== USER) throw new Error(`Token belongs to ${data.viewer.login}, expected ${USER}`);

const repos = data.viewer.repositories.nodes
  .filter((r) => !r.isArchived && r.name !== USER)
  .slice(0, COUNT);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// Greedy word wrap by character count; good enough for a 13px sans-serif line.
function wrap(text, width, maxLines) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.splice(maxLines - 1, Infinity, clip(lines.slice(maxLines - 1).join(" "), width));
  return lines;
}

function card(repo) {
  const font = `font-family="Segoe UI,Ubuntu,Helvetica Neue,Helvetica,Arial,sans-serif"`;
  const desc = wrap(repo.description || "No description yet.", 52, 2)
    .map((line, i) => `<text x="20" y="${64 + i * 19}" ${font} font-size="13" fill="#38bdae">${esc(line)}</text>`)
    .join("\n  ");
  const lang = repo.primaryLanguage;
  const langMark = lang
    ? `<circle cx="26" cy="110" r="6" fill="${esc(lang.color || "#8b949e")}"/>
  <text x="38" y="114.5" ${font} font-size="12" fill="#a9b1d6">${esc(lang.name)}</text>`
    : "";
  const updated = new Date(repo.pushedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const badge = repo.isPrivate ? "Private" : "Public";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="132" viewBox="0 0 400 132" role="img" aria-label="${esc(repo.name)}">
  <rect x="0.5" y="0.5" width="399" height="131" rx="6" fill="#1a1b27" stroke="#2a2e45"/>
  <text x="20" y="36" ${font} font-size="17" font-weight="600" fill="#70a5fd">${esc(clip(repo.name, 30))}</text>
  <rect x="318.5" y="20.5" width="62" height="21" rx="10.5" fill="none" stroke="#bf91f3"/>
  <text x="349.5" y="35" ${font} font-size="11" fill="#bf91f3" text-anchor="middle">${badge}</text>
  ${desc}
  ${langMark}
  <text x="380" y="114.5" ${font} font-size="12" fill="#a9b1d6" text-anchor="end">Updated ${updated}</text>
</svg>
`;
}

mkdirSync(join(root, "assets/featured"), { recursive: true });
const tags = repos.map((repo, i) => {
  const file = `assets/featured/${i + 1}.svg`;
  writeFileSync(join(root, file), card(repo));
  const img = `<img src="${file}" width="400" alt="${esc(repo.name)}" />`;
  const link = repo.homepageUrl || (repo.isPrivate ? null : repo.url);
  return "  " + (link ? `<a href="${esc(link)}">${img}</a>` : img);
});

const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const markers = /(<!-- FEATURED:START[^\n]*-->\n)[\s\S]*?(<!-- FEATURED:END -->)/;
if (!markers.test(readme)) throw new Error("FEATURED markers not found in README.md");
writeFileSync(readmePath, readme.replace(markers, (_, start, end) => `${start}${tags.join("\n")}\n${end}`));
console.log(repos.map((r) => r.name).join("\n"));
