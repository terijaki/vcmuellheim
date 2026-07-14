/**
 * Member proxy alias utilities:
 * - Alias suggestion via normalized name + domain
 * - German character normalization
 * - Dev branch suffix support (plus-addressing)
 */

import { Mail } from "@/project.config";
import { sanitizeBranchName } from "@utils/git";

/** Map of German special characters to ASCII equivalents */
const GERMAN_CHAR_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
  ß: "ss",
};

/**
 * Normalize a member name into a proxy alias local part.
 *
 * Examples:
 *   "Max Müller"   → "max.mueller"
 *   "Björn Koß" → "bjoern.koss"
 *   "Anna-Lisa"    → "anna.lisa" (hyphens converted to dots)
 */
export function normalizeAliasLocalPart(name: string): string {
  return name
    .split("")
    .map((ch) => GERMAN_CHAR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function formatProxyAlias(localPart: string, domain: string, branchName?: string): string {
  const sanitizedBranchName = branchName ? sanitizeBranchName(branchName) : "";
  const suffix = sanitizedBranchName ? `+${sanitizedBranchName}` : "";
  return `${localPart}${suffix}@${domain}`;
}

type ParsedProxyAlias = {
  baseLocalPart: string;
  branchName?: string;
  domain: string;
};

export function parseProxyAlias(proxyEmail: string, fallbackDomain: string): ParsedProxyAlias {
  const [localPart = "", domain = fallbackDomain] = proxyEmail.split("@");
  const [baseLocalPart = "", ...branchParts] = localPart.split("+");
  const branchName = branchParts.length > 0 ? branchParts.join("+") : undefined;

  return {
    baseLocalPart,
    branchName,
    domain,
  };
}

export function canonicalizeProxyAlias(
  proxyEmail: string,
  cdkEnvironment = process.env.CDK_ENVIRONMENT,
  branchName = process.env.BRANCH_NAME,
): string {
  const fallbackDomain = getProxyAliasDomain(cdkEnvironment);
  const { baseLocalPart, domain } = parseProxyAlias(proxyEmail, fallbackDomain);
  const canonicalBranchName = getProxyAliasBranchName(cdkEnvironment, branchName);

  return formatProxyAlias(baseLocalPart, domain, canonicalBranchName);
}

export function suggestProxyAlias(
  name: string,
  domain: string,
  branchName?: string,
  counter?: number,
): string {
  const localPart = normalizeAliasLocalPart(name);
  const localPartWithCounter = counter && counter > 1 ? `${localPart}${counter}` : localPart;
  return formatProxyAlias(localPartWithCounter, domain, branchName);
}

export function isProdProxyAliasDomain(domain: string): boolean {
  return domain === Mail.prod.recipientDomain;
}

export function getProxyAliasDomain(cdkEnvironment?: string, hostname?: string): string {
  if (hostname && isProdProxyAliasHostname(hostname)) {
    return Mail.prod.recipientDomain;
  }

  if (hostname && isDevProxyAliasHostname(hostname)) {
    return Mail.dev.recipientDomain;
  }

  const resolvedEnvironment = cdkEnvironment ?? process.env.CDK_ENVIRONMENT;
  if (resolvedEnvironment === "prod") {
    return Mail.prod.recipientDomain;
  }

  return Mail.dev.recipientDomain;
}

function isProdProxyAliasHostname(hostname: string): boolean {
  return hostname === Mail.prod.recipientDomain || hostname === `www.${Mail.prod.recipientDomain}`;
}

function isDevProxyAliasHostname(hostname: string): boolean {
  return hostname === Mail.dev.recipientDomain || hostname.endsWith(`.${Mail.dev.recipientDomain}`);
}

export function getProxyAliasBranchName(
  cdkEnvironment?: string,
  branchName = process.env.BRANCH_NAME,
  domain?: string,
): string | undefined {
  const resolvedEnvironment = cdkEnvironment ?? process.env.CDK_ENVIRONMENT;
  const isProdContext =
    (domain !== undefined && isProdProxyAliasDomain(domain)) ||
    (domain === undefined && resolvedEnvironment === "prod");

  if (isProdContext) {
    return undefined;
  }

  if (!branchName || branchName === "main") {
    return undefined;
  }

  const sanitizedBranchName = sanitizeBranchName(branchName);
  if (!sanitizedBranchName || sanitizedBranchName === "main") {
    return undefined;
  }

  return sanitizedBranchName;
}
