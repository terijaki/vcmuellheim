import { describe, expect, test } from "vite-plus/test";
import { normalizeAliasLocalPart, normalizeProxyAlias } from "./member-alias";

describe("normalizeAliasLocalPart", () => {
	test("lowercases plain ASCII names", () => {
		expect(normalizeAliasLocalPart("Max Muster")).toBe("max.muster");
	});

	test("replaces spaces with dots", () => {
		expect(normalizeAliasLocalPart("Hans Georg Mustermann")).toBe("hans.georg.mustermann");
	});

	test("converts German umlauts to ASCII equivalents", () => {
		expect(normalizeAliasLocalPart("Max Müller")).toBe("max.mueller");
		expect(normalizeAliasLocalPart("Björn Köhnen")).toBe("bjoern.koehnen");
		expect(normalizeAliasLocalPart("Jürgen Ößwald")).toBe("juergen.oesswald");
	});

	test("converts all upper-case umlaut variants", () => {
		expect(normalizeAliasLocalPart("Ä Ö Ü ß")).toBe("ae.oe.ue.ss");
	});

	test("collapses consecutive non-alphanumeric characters into a single dot", () => {
		expect(normalizeAliasLocalPart("Anna--Lisa")).toBe("anna.lisa");
		expect(normalizeAliasLocalPart("von  der  Heide")).toBe("von.der.heide");
	});

	test("strips leading and trailing dots", () => {
		expect(normalizeAliasLocalPart(" Max ")).toBe("max");
		expect(normalizeAliasLocalPart(".Max.")).toBe("max");
	});

	test("keeps numbers in the output", () => {
		expect(normalizeAliasLocalPart("Max2 Mustermann")).toBe("max2.mustermann");
	});
});

describe("normalizeProxyAlias", () => {
	test("builds full email address from name and domain", () => {
		expect(normalizeProxyAlias("Max Müller", "vcmuellheim.de")).toBe("max.mueller@vcmuellheim.de");
	});

	test("appends plus-address branch suffix when branchName is provided", () => {
		expect(normalizeProxyAlias("Max Müller", "vcmuellheim.de", "feat-x")).toBe("max.mueller+feat-x@vcmuellheim.de");
	});

	test("omits branch suffix when branchName is undefined", () => {
		expect(normalizeProxyAlias("Anna Trainer", "vcmuellheim.de", undefined)).toBe("anna.trainer@vcmuellheim.de");
	});

	test("omits branch suffix when branchName is empty string", () => {
		// Empty string is falsy — no suffix should be added
		expect(normalizeProxyAlias("Anna Trainer", "vcmuellheim.de", "")).toBe("anna.trainer@vcmuellheim.de");
	});
});
