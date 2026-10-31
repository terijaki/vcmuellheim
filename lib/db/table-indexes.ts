/** Shared GSI names for the single-table content database. */
export const ContentTableIndexes = {
  table: "table",
  gsi1: "GSI1-ByTypeAndDate",
} as const;

/** Shared GSI names for the SAMS data table. */
export const SamsTableIndexes = {
  table: "table",
  gsi1: "GSI1-BySamsType",
} as const;
