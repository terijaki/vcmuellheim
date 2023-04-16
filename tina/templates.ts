import type { TinaField } from "tinacms";
export function ank_ndigungFields() {
  return [
    {
      type: "string",
      name: "title",
      label: "Title",
    },
    {
      type: "datetime",
      name: "date",
      label: "Datum",
    },
    {
      type: "datetime",
      name: "end",
      label: "Ende",
    },
  ] as TinaField[];
}
export function mannschaftFields() {
  return [
    {
      type: "string",
      name: "layout",
      label: "layout",
    },
    {
      type: "string",
      name: "title",
      label: "Team Name",
      required: true,
    },
    {
      type: "string",
      name: "liga",
      label: "Liga",
      options: [
        "[01] Bundesliga",
        "[02] 2. Bundesliga",
        "[03] 3. Liga",
        "[04] Regionalliga",
        "[05] Oberliga",
        "[06] Verbandsliga",
        "[07] Landesliga",
        "[08] Bezirksliga",
        "[09] Bezirksklasse",
        "[10] Kreisliga",
        "[11] Kreisklasse",
        "[99] Kein Ligabetrieb",
      ],
    },
    {
      type: "string",
      name: "alter",
      label: "Altersgruppe",
    },
    {
      type: "string",
      name: "trainings_zeit1",
      nameOverride: "trainings-zeit1",
      label: "Trainingszeit 1",
    },
    {
      type: "string",
      name: "trainings_ort1",
      nameOverride: "trainings-ort1",
      label: "Trainingsort 1",
    },
    {
      type: "string",
      name: "trainings_map1",
      nameOverride: "trainings-map1",
      label: "Trainingsort 1 (Google Maps)",
    },
    {
      type: "string",
      name: "trainings_zeit2",
      nameOverride: "trainings-zeit2",
      label: "Trainingszeit 2",
    },
    {
      type: "string",
      name: "trainings_ort2",
      nameOverride: "trainings-ort2",
      label: "Trainingsort 2",
    },
    {
      type: "string",
      name: "trainings_map2",
      nameOverride: "trainings-map2",
      label: "Trainingsort 2 (Google Maps)",
    },
    {
      type: "string",
      name: "trainer_name1",
      nameOverride: "trainer-name1",
      label: "Trainer 1: Name",
    },
    {
      type: "string",
      name: "trainer_email1",
      nameOverride: "trainer-email1",
      label: "Trainer 1: Emal",
    },
    {
      type: "string",
      name: "trainer_name2",
      nameOverride: "trainer-name2",
      label: "Trainer 2: Name",
    },
    {
      type: "string",
      name: "trainer_email2",
      nameOverride: "trainer-email2",
      label: "Trainer 2: Email",
    },
    {
      type: "string",
      name: "ansprechperson_name1",
      nameOverride: "ansprechperson-name1",
      label: "Ansprechperson 1: Name",
    },
    {
      type: "string",
      name: "ansprechperson_email1",
      nameOverride: "ansprechperson-email1",
      label: "Ansprechperson 1: Emal",
    },
    {
      type: "string",
      name: "ansprechperson_name2",
      nameOverride: "ansprechperson-name2",
      label: "Ansprechperson 2: Name",
    },
    {
      type: "string",
      name: "ansprechperson_email2",
      nameOverride: "ansprechperson-email2",
      label: "Ansprechperson 2: Email",
    },
    {
      type: "string",
      name: "kommentar",
      label: "Kommentar",
      ui: {
        component: "textarea",
      },
    },
    {
      type: "number",
      name: "sbvv_id",
      label: "SBVV ID",
    },
  ] as TinaField[];
}
export function newsFields() {
  return [
    {
      type: "string",
      name: "layout",
      label: "layout",
      required: true,
    },
    {
      type: "string",
      name: "excerpt_separator",
      label: "excerpt_separator",
      required: true,
    },
    {
      type: "string",
      name: "title",
      label: "Title",
      required: true,
    },
    {
      type: "image",
      name: "thumbnail",
      label: "Thumbnail",
    },
    {
      type: "image",
      name: "gallery",
      label: "Gallery",
      list: true,
    },
  ] as TinaField[];
}
export function vereinsmitgliedFields() {
  return [
    {
      type: "string",
      name: "name",
      label: "name",
      required: true,
    },
    {
      type: "string",
      name: "email",
      label: "email",
    },
    {
      type: "string",
      name: "function",
      label: "function",
      required: true,
    },
    {
      type: "image",
      name: "avatar",
      label: "avatar",
    },
    {
      type: "number",
      name: "sortorder",
      label: "sortorder",
      required: true,
    },
  ] as TinaField[];
}
export function termineFields() {
  return [] as TinaField[];
}
