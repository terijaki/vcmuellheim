import fs from "fs";
import path from "path";

const CACHE_FOLDER = process.env.SAMS_CACHE || "./temp/sams";

export const revalidate = 10;
// export const dynamic = "force-dynamic";

export default async function debugPage() {
	const timenumber = new Date().getSeconds().toString().slice(0, 2);
	const cacheFile = Bun.file(path.join(CACHE_FOLDER, "red" + timenumber + ".json"), { type: "application/json" });
	Bun.write(cacheFile, "test body hello world");

	return (
		<div className="col-full-content">
			<div>You are heres: {fs.realpathSync(".")}</div>
			<div>Environment Value: {process.env.SAMSCACHE}</div>
			<div>Timestamp:{new Date().toLocaleTimeString("de")}</div>

			<div>Look 2 🌈:</div>
			<ul>
				{fs.readdirSync(CACHE_FOLDER).map((file) => (
					<li
						key={file}
						className="list-outside"
					>
						- {file}
						<br />
					</li>
				))}
			</ul>
		</div>
	);
}
