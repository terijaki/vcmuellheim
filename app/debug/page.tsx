import { readdir } from "node:fs/promises";
import fs from "fs";

export default async function debugPage() {
	// fs.writeFileSync("../.temp/test.json", "hello world");
	// fs.writeFileSync("tmp/sams/ok.json", "hello world");
	fs.writeFileSync(".temp/sams/either.json", "hello world");
	// fs.writeFileSync("../.temp/sams/eitherneither.json", "hello world");
	const files = await readdir("/");

	console.log(fs.realpathSync("."));

	return (
		<div className="col-full-content">
			<div>You are heres: {fs.realpathSync(".")}</div>
			<div>Here are the files:</div>
			<ul>
				{files.map((file) => (
					<li key={file}>{file}</li>
				))}
			</ul>
		</div>
	);
}
