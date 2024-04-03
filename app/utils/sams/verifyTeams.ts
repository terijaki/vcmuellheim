import fs from "fs";
import path from "path";
import { env } from "process";
import { writeToSummary } from "../github/actionSummary";
import { teamObject } from "../getTeams";

const TEAMS_FOLDER = "data/teams",
	CLUB_CACHE_FILE = "data/sams/club.json";
const SAMS_CLUB_ID = env.SAMS_CLUBID;

type teamSetItem = { filename: string; title: string; sbvvId: number | boolean };

export default function verifyTeams() {
	// read the cache file
	const clubData = fs.readFileSync(CLUB_CACHE_FILE).toString();
	// create a new set for invalid IDs to loop through later
	let teamsWithMissingIds = new Set<teamSetItem>();
	// create a new set for the github summary
	let summaryList = new Set<string>();
	// read all team files and loop through them
	const files = fs.readdirSync(TEAMS_FOLDER);
	files.forEach((file) => {
		// read the file and prepare the object
		const teamData = fs.readFileSync(path.join(TEAMS_FOLDER, file));
		const teamJson: teamObject = JSON.parse(teamData.toString());
		// check which teams have an sbvvId and which of these are no longer present in the club cache file
		if (teamJson.title) {
			if (typeof teamJson.sbvvId === "number") {
				if (clubData.includes(teamJson.sbvvId.toString())) {
					let consoleNote = "✅ " + teamJson.title + " SBVV-ID (" + teamJson.sbvvId + ") found in the club data.";
					console.log(consoleNote);
					summaryList.add(consoleNote);
				} else {
					let consoleNote = "🚨 " + teamJson.title + " SBVV-ID (" + teamJson.sbvvId + ") was not found in the club data.";
					console.log(consoleNote);
					summaryList.add(consoleNote);
					teamsWithMissingIds.add({ filename: file, title: teamJson.title, sbvvId: teamJson.sbvvId });
				}
			} else if (teamJson.sbvvId) {
				let consoleNote = "🚨 " + teamJson.title + " has no valid SBVV-ID: " + teamJson.sbvvId;
				console.log(consoleNote);
				summaryList.add(consoleNote);
				teamsWithMissingIds.add({ filename: file, title: teamJson.title, sbvvId: teamJson.sbvvId });
			} else {
				let consoleNote = "✅ " + teamJson.title + " has no SBVV-ID on record.";
				console.log(consoleNote);
				summaryList.add(consoleNote);
			}
		}
	});
	// process any broken/missing id
	if (teamsWithMissingIds.size > 0) {
		summaryList.forEach((entry) => {
			writeToSummary(entry);
		});
		teamsWithMissingIds.forEach(async (team: teamSetItem) => {
			await removeSbvvIdFromTeam(team);
		});
	} else {
		let consoleNote = "✅ SBVV-IDs are all up to date.";
		writeToSummary(consoleNote);
	}
}

// function for modifying the cache files
async function removeSbvvIdFromTeam(team: teamSetItem) {
	const filepath = path.join(TEAMS_FOLDER, team.filename);
	// remove the id from the team
	const cachedFile = fs.readFileSync(filepath);
	const teamObject = JSON.parse(cachedFile.toString());
	teamObject.sbvvId = false;
	// update the team file
	fs.writeFileSync(filepath, JSON.stringify(teamObject, null, 2));

	// create a ticket for the modified team
	await createTicketForInvalidTeam(team);
}

// function to create the Github tickets
async function createTicketForInvalidTeam(newteam: teamSetItem) {
	console.log("DEBUG TICKET: " + newteam.title);
	const titleMessage = "SBVV-ID for " + newteam.title + " outdated or invalid";
	const bodyMessage =
		"**" +
		newteam.title +
		"** is either outdated or has some other problem with its SBVV-ID: **" +
		newteam.sbvvId +
		"**\n\nSee [SBVV website](https://www.sbvv-online.de/cms/startseite/verband/ueber_uns/vereine.xhtml?c4302050.view=teams&c4302050.club=" +
		SAMS_CLUB_ID +
		"&c4302050.type=list) for an easy way to see the current IDs of our club on the SBVV server.";

	// const octokit = new Octokit({ auth: "12341242412" });

	if (process.env.GITHUB_REPOSITORY) {
		console.log("Creating issue via action.js..");
		const { Octokit } = require("@octokit/action");
		const octokit = new Octokit();
		const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
		const { data } = await octokit.request("POST /repos/{owner}/{repo}/issues", {
			owner,
			repo,
			title: titleMessage,
			body: bodyMessage,
			labels: ["action required"],
		});
		let consoleNote = "Issue created for " + newteam.title + ": " + data.html_url;
		console.log(consoleNote);
		writeToSummary(consoleNote);
	} else if (env.GITHUB_TOKEN) {
		console.log("Creating issue via core.js..");
		const { Octokit } = require("@octokit/core");
		const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
		const { data } = await octokit.request("POST /repos/{owner}/{repo}/issues", {
			owner: env.GITHUB_OWNER,
			repo: env.GITHUB_REPO,
			title: titleMessage,
			body: bodyMessage,
			labels: ["action required"],
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
		let consoleNote = "Issue created for " + newteam.title + ": " + data.html_url;
		console.log(consoleNote);
		writeToSummary(consoleNote);
	}
}
