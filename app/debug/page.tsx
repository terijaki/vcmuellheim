import fs from "fs";
import { mkdir } from "node:fs/promises";

export default async function debugPage() {
	await mkdir("/app/.temp/sams", { recursive: true });
	const cacheFile = Bun.file("/app/.temp/sams/allClubs.json", { type: "application/json" });
	Bun.write(cacheFile, "test body hello world");

	// fs.writeFileSync("../.temp/test.json", "hello world");
	// fs.writeFileSync("tmp/sams/ok.json", "hello world");
	// fs.writeFileSync("either.json", "hello world");
	// // fs.writeFileSync("../.temp/sams/eitherneither.json", "hello world");
	// const files = await readdir("/");

	// console.log(fs.realpathSync("."));

	return (
		<div className="col-full-content">
			<div>You are heres: {fs.realpathSync(".")}</div>
		</div>
	);
}
