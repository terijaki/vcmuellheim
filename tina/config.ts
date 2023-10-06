import moment from "moment";
import { DateField, defineConfig } from "tinacms";

// Your hosting provider likely exposes this as an environment variable
const branch = process.env.HEAD || process.env.VERCEL_GIT_COMMIT_REF || "main";

export default defineConfig({
  branch: "main",
  clientId: process.env.TINA_PUBLIC_CLIENT_ID!,
  token: process.env.TINA_TOKEN!,

  build: {
    outputFolder: "edit",
    publicFolder: "./",
  },
  media: {
    tina: {
      mediaRoot: "upload",
      publicFolder: "./",
    },
  },
  schema: {
    collections: [
      {
        name: "post",
        label: "Beiträge",
        path: "_posts",
        format: 'md',
        defaultItem: () => {
          return {
            layout: 'post',
          }
        },
        ui: {
          filename: {
            readonly: true,
            slugify: (values) => {
              return `${moment().format('YYYY-MM-DD')}-${values?.title
                ?.toLowerCase()
                .replace(/\u00e4/g, "ae")
                .replace(/\u00fc/g, "ue")
                .replace(/\u00f6/g, "oe")
                .replace(/([^a-z0-9 ]+)/gi, '')
                .trim()
                .replace(/ /g, '-')
              }`
            },
          },
        },
        fields: [
          {
            type: "string",
            name: "layout",
            required: true,
            ui: {
              component: () => null
            },
          },
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "image",
            name: "thumbnail",
            label: "Thumbnail",
            description: "Vorschaubild das bereits vor dem öffnen des Beitrags angezeigt wird.",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
          },
          {
            type: "image",
            label: "Image Gallery",
            name: "gallery",
            list: true,
          },
        ],
      },
      {
        name: "club_members",
        label: "Vorstand & Vereinsämter",
        path: "_club_members",
        format: 'md',
        fields: [
          {
            name: "name",
            label: "Name",
            type: "string",
            isTitle: true,
            required: true,
          },
          {
            name: "avatar",
            label: "Avatar",
            type: "image",
          },
          {
            name: "email",
            label: "E-Mail",
            type: "string",
          },
          {
            name: "function",
            label: "Function",
            type: "string",
          },
          {
            name: "sortorder",
            label: "Sort Order",
            type: "number",
          },
        ],
      },
    ],
  },
  search: {
    tina: {
      indexerToken: 'cbff9eab10cebdc5cddd784c6d4edab6142e5f24',
      stopwordLanguages: ['deu']
    },
    indexBatchSize: 100,
    maxSearchIndexFieldLength: 100
  },
});