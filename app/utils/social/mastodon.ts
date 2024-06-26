import { Mastodon } from "@/project.config";
import { env } from "process";

const INSTANCE: string = Mastodon.instance + "",
	CLIENT_ID: string = Mastodon.clientId + "",
	ACCESS_TOKEN: string = env.MASTODON_ACCESS_TOKEN + "";

type mastodonStatusResponse = {
	id: string;
	created_at: string;
	visibility: string;
	url: string;
	content: string;
};

// search if the status already exists
export async function mastodonSearchStatus(searchTerm: string): Promise<{ status: number; response: [mastodonStatusResponse] }> {
	return new Promise(async (resolve, reject) => {
		try {
			const searchStatusHeader = {
				Accept: "*/*",
				Authorization: "Bearer " + ACCESS_TOKEN,
			};
			const searchStatus = await fetch("https://" + INSTANCE + "/api/v2/search?q=%22" + searchTerm + "%22&type=statuses&account_id=" + CLIENT_ID, {
				method: "GET",
				headers: searchStatusHeader,
			});

			let response = await JSON.parse(await searchStatus.text());
			resolve({ status: searchStatus.status, response: response.statuses });
		} catch (error) {
			console.log(error);
			reject(error);
		}
	});
}

// post a status on mastodon
export async function mastodonPostStatus(statusMessage: string): Promise<{ status: number; response: mastodonStatusResponse }> {
	return new Promise(async (resolve, reject) => {
		try {
			const postStatusHeader = {
				Accept: "*/*",
				Authorization: "Bearer " + ACCESS_TOKEN,
			};
			const postStatus = await fetch("https://" + INSTANCE + "/api/v1/statuses?status=" + statusMessage, {
				method: "POST",
				headers: postStatusHeader,
			});

			let response = await JSON.parse(await postStatus.text());
			resolve({ status: postStatus.status, response: response });
		} catch (error) {
			console.log(error);
			reject(error);
		}
	});
}

// fetching the clint id using the Mastodon name
export async function mastodonUserId(mastodonName: string): Promise<string> {
	return new Promise(async (resolve, reject) => {
		const response = await fetch("https://freiburg.social/api/v1/accounts/lookup?acct=" + mastodonName, { method: "GET" });
		if (response.status == 200) {
			const responseJson = await response.json();
			resolve(responseJson.id);
		} else {
			reject("🚨 could not retrieve account id for " + mastodonName);
		}
	});
}
