import { Mastodon } from "@/project.config";

const INSTANCE: string = Mastodon.instance;
const CLIENT_ID: string = Mastodon.clientId;
const ACCESS_TOKEN: string = `${process.env.MASTODON_ACCESS_TOKEN}`;

type mastodonStatusResponse = {
	id: string;
	created_at: string;
	visibility: string;
	url: string;
	content: string;
};

// search if the status already exists
export async function mastodonSearchStatus(
	searchTerm: string,
): Promise<{ status: number; response: [mastodonStatusResponse] }> {
	return new Promise((resolve, reject) => {
		const searchStatusHeader = {
			Accept: "*/*",
			Authorization: `Bearer ${ACCESS_TOKEN}`,
		};
		fetch(`https://${INSTANCE}/api/v2/search?q=%22${searchTerm}%22&type=statuses&account_id=${CLIENT_ID}`, {
			method: "GET",
			headers: searchStatusHeader,
		})
			.then((searchStatus) => searchStatus.text())
			.then((text) => {
				const response = JSON.parse(text);
				resolve({ status: 200, response: response.statuses });
			})
			.catch((error) => {
				console.log(error);
				reject(error);
			});
	});
}

// post a status on mastodon
export async function mastodonPostStatus(
	statusMessage: string,
): Promise<{ status: number; response: mastodonStatusResponse }> {
	return new Promise((resolve, reject) => {
		const postStatusHeader = {
			Accept: "*/*",
			Authorization: `Bearer ${ACCESS_TOKEN}`,
		};
		fetch(`https://${INSTANCE}/api/v1/statuses?status=${statusMessage}`, {
			method: "POST",
			headers: postStatusHeader,
		})
			.then((postStatus) => {
				return postStatus.text().then((text) => {
					const response = JSON.parse(text);
					resolve({ status: postStatus.status, response });
				});
			})
			.catch((error) => {
				console.log(error);
				reject(error);
			});
	});
}

// fetching the clint id using the Mastodon name
export async function mastodonUserId(mastodonName: string): Promise<string> {
	const response = await fetch(`https://freiburg.social/api/v1/accounts/lookup?acct=${mastodonName}`, {
		method: "GET",
	});
	if (response.status === 200) {
		const responseJson = await response.json();
		return responseJson.id;
	}
	throw new Error(`🚨 could not retrieve account id for ${mastodonName}`);
}
