import fs from "fs";

const GITHUB_SUMMARY_FILE = "github_summary.md";

// this writes to a file that is being read during a github actions run to craft a summary of the job
export function writeToSummary(text: string) {
	if (!fs.existsSync(GITHUB_SUMMARY_FILE)) {
		fs.writeFileSync(GITHUB_SUMMARY_FILE, "");
	}
	fs.appendFileSync(GITHUB_SUMMARY_FILE, text + "\n");
}
