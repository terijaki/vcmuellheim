import { describe, expect, test } from "vite-plus/test";
import {
  canonicalizeProxyAlias,
  getProxyAliasBranchName,
  getProxyAliasDomain,
  isProdProxyAliasDomain,
  normalizeAliasLocalPart,
  parseProxyAlias,
  suggestProxyAlias,
} from "./member-alias";

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

describe("suggestProxyAlias", () => {
  test("builds full email address from name and domain", () => {
    expect(suggestProxyAlias("Max Müller", "vcmuellheim.de")).toBe("max.mueller@vcmuellheim.de");
  });

  test("appends plus-address branch suffix when branchName is provided", () => {
    expect(suggestProxyAlias("Max Müller", "vcmuellheim.de", "feat-x")).toBe(
      "max.mueller+feat-x@vcmuellheim.de",
    );
  });

  test("omits branch suffix when branchName is undefined", () => {
    expect(suggestProxyAlias("Anna Trainer", "vcmuellheim.de", undefined)).toBe(
      "anna.trainer@vcmuellheim.de",
    );
  });

  test("omits branch suffix when branchName is empty string", () => {
    // Empty string is falsy — no suffix should be added
    expect(suggestProxyAlias("Anna Trainer", "vcmuellheim.de", "")).toBe(
      "anna.trainer@vcmuellheim.de",
    );
  });

  test("uses the dev branch suffix on the new domain", () => {
    expect(suggestProxyAlias("Max Müller", "new.vcmuellheim.de", "email-proxy")).toBe(
      "max.mueller+email-proxy@new.vcmuellheim.de",
    );
  });

  test("sanitizes slashes in branch names for valid plus-address suffixes", () => {
    expect(suggestProxyAlias("Julia Fischer", "new.vcmuellheim.de", "terijaki/f3ed6e0f")).toBe(
      "julia.fischer+terijaki-f3ed6e0f@new.vcmuellheim.de",
    );
  });

  test("applies duplicate numbering before the branch suffix", () => {
    expect(suggestProxyAlias("Max Müller", "new.vcmuellheim.de", "email-proxy", 2)).toBe(
      "max.mueller2+email-proxy@new.vcmuellheim.de",
    );
  });
});

describe("proxy alias environment helpers", () => {
  test("uses the production recipient domain in prod", () => {
    expect(getProxyAliasDomain("prod")).toBe("vcmuellheim.de");
    expect(getProxyAliasBranchName("prod", "email-proxy")).toBeUndefined();
  });

  test("uses the development recipient domain and branch suffix outside prod", () => {
    expect(getProxyAliasDomain("dev")).toBe("new.vcmuellheim.de");
    expect(getProxyAliasBranchName("dev", "email-proxy")).toBe("email-proxy");
  });

  test("infers recipient domain from hostname when build-time env is missing", () => {
    const previousEnvironment = process.env.CDK_ENVIRONMENT;
    delete process.env.CDK_ENVIRONMENT;

    try {
      expect(getProxyAliasDomain(undefined, "vcmuellheim.de")).toBe("vcmuellheim.de");
      expect(getProxyAliasDomain(undefined, "www.vcmuellheim.de")).toBe("vcmuellheim.de");
      expect(getProxyAliasDomain(undefined, "dev.new.vcmuellheim.de")).toBe("new.vcmuellheim.de");
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.CDK_ENVIRONMENT;
      } else {
        process.env.CDK_ENVIRONMENT = previousEnvironment;
      }
    }
  });

  test("prefers dev hostname over build-time prod env", () => {
    expect(getProxyAliasDomain("prod", "dev.new.vcmuellheim.de")).toBe("new.vcmuellheim.de");
  });

  test("keeps branch suffix on dev domain when build-time env is prod", () => {
    expect(getProxyAliasBranchName("prod", "email-proxy", "new.vcmuellheim.de")).toBe(
      "email-proxy",
    );
  });

  test("sanitizes slashes in raw branch names for alias suffixes", () => {
    expect(getProxyAliasBranchName("dev", "terijaki/f3ed6e0f", "new.vcmuellheim.de")).toBe(
      "terijaki-f3ed6e0f",
    );
  });

  test("hides branch suffix on production recipient domains", () => {
    expect(isProdProxyAliasDomain("vcmuellheim.de")).toBe(true);
    expect(getProxyAliasBranchName("dev", "main", "vcmuellheim.de")).toBeUndefined();
    expect(getProxyAliasBranchName(undefined, "main", "vcmuellheim.de")).toBeUndefined();
  });

  test("hides the main branch suffix outside prod", () => {
    expect(getProxyAliasBranchName("dev", "main", "new.vcmuellheim.de")).toBeUndefined();
    expect(getProxyAliasBranchName(undefined, "main", "new.vcmuellheim.de")).toBeUndefined();
  });
});

describe("parseProxyAlias", () => {
  test("splits base local part, branch suffix and domain", () => {
    expect(parseProxyAlias("max.mueller+email-proxy@new.vcmuellheim.de", "fallback.de")).toEqual({
      baseLocalPart: "max.mueller",
      branchName: "email-proxy",
      domain: "new.vcmuellheim.de",
    });
  });

  test("uses fallback domain and no branch for plain local-part", () => {
    expect(parseProxyAlias("max.mueller", "new.vcmuellheim.de")).toEqual({
      baseLocalPart: "max.mueller",
      branchName: undefined,
      domain: "new.vcmuellheim.de",
    });
  });
});

describe("canonicalizeProxyAlias", () => {
  test("adds current branch suffix in dev", () => {
    expect(canonicalizeProxyAlias("max.mueller@new.vcmuellheim.de", "dev", "email-proxy")).toBe(
      "max.mueller+email-proxy@new.vcmuellheim.de",
    );
  });

  test("rewrites stale branch suffix to current branch in dev", () => {
    expect(
      canonicalizeProxyAlias("max.mueller+old-branch@new.vcmuellheim.de", "dev", "email-proxy"),
    ).toBe("max.mueller+email-proxy@new.vcmuellheim.de");
  });

  test("removes branch suffix in prod", () => {
    expect(
      canonicalizeProxyAlias("max.mueller+email-proxy@vcmuellheim.de", "prod", "email-proxy"),
    ).toBe("max.mueller@vcmuellheim.de");
  });

  test("rewrites unsanitized branch suffix to sanitized form in dev", () => {
    expect(
      canonicalizeProxyAlias(
        "julia.fischer+terijaki/f3ed6e0f@new.vcmuellheim.de",
        "dev",
        "terijaki/f3ed6e0f",
      ),
    ).toBe("julia.fischer+terijaki-f3ed6e0f@new.vcmuellheim.de");
  });
});
