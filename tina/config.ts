import { defineConfig } from "tinacms";
import { ank_ndigungFields } from "./templates";
import { mannschaftFields } from "./templates";
import { newsFields } from "./templates";
import { vereinsmitgliedFields } from "./templates";
import { termineFields } from "./templates";

// Your hosting provider likely exposes this as an environment variable
const branch = process.env.HEAD || process.env.VERCEL_GIT_COMMIT_REF || "main";

export default defineConfig({
  branch,
  clientId: " f7f73962-b2fd-4ec6-b60e-072df3c602c9", // Get this from tina.io
  token: "9bae1d031ce22f4e0e42db78fd84f2bb7f374b8e", // Get this from tina.io
  client: { skip: true },
  build: {
    outputFolder: "admin",
    publicFolder: "./",
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "./",
    },
  },
  schema: {
    collections: [
      {
        format: "md",
        label: "Ankündigungen",
        name: "ankuendigungen",
        path: "_announcements",
        match: {
          include: "**/*",
        },
        fields: [
          {
            type: "rich-text",
            name: "body",
            label: "Body of Document",
            description: "This is the markdown body",
            isBody: true,
          },
          ...ank_ndigungFields(),
        ],
      },
      {
        format: "md",
        label: "Termine",
        name: "termine",
        path: "_termine",
        match: {
          include: "**/*",
        },
        fields: [
          {
            type: "rich-text",
            name: "body",
            label: "Body of Document",
            description: "This is the markdown body",
            isBody: true,
          },
        ],
      },
      {
        format: "md",
        label: "Mannschaften",
        name: "mannschaften",
        path: "_teams",
        match: {
          include: "**/*",
        },
        fields: [
          {
            type: "rich-text",
            name: "body",
            label: "Body of Document",
            description: "This is the markdown body",
            isBody: true,
          },
          ...mannschaftFields(),
        ],
      },
      {
        format: "md",
        label: "Vorstand & Vereinsämter",
        name: "vorstand_vereins_mitglieder",
        path: "_club_members",
        match: {
          include: "**/*",
        },
        fields: [
          {
            type: "rich-text",
            name: "body",
            label: "Body of Document",
            description: "This is the markdown body",
            isBody: true,
          },
          ...vereinsmitgliedFields(),
        ],
      },
    ],
  },
});
