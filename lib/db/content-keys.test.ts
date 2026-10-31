import { describe, expect, it } from "vite-plus/test";
import {
  memberMainKeys,
  memberPrivateEmailKeys,
  newsGsi1,
  newsItemFromDomain,
  newsMainKeys,
  newsSlugLookupKeys,
  volunteerSignupCollectionKeys,
  volunteerSignupIdLookupKeys,
} from "./content-keys";
import { newsSchema } from "./schemas";

describe("native content DynamoDB keys", () => {
  it("news main, gsi1, and slug lookup keys", () => {
    const article = newsSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      type: "article",
      title: "Title",
      slug: "my-slug",
      content: "Body",
      status: "published",
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-20T12:30:00.000Z",
    });

    expect(newsMainKeys(article.id)).toEqual({
      pk: "news#11111111-1111-4111-8111-111111111111",
      sk: "news",
    });
    expect(newsGsi1("published", article.createdAt)).toEqual({
      gsi1pk: "news#published",
      gsi1sk: article.createdAt,
    });
    expect(newsSlugLookupKeys("my-slug")).toEqual({
      pk: "news#slug#my-slug",
      sk: "news",
    });

    const item = newsItemFromDomain(article);
    expect(item.pk).toBe("news#11111111-1111-4111-8111-111111111111");
    expect(item.gsi1pk).toBe("news#published");
  });

  it("member email index keys use trimmed private email", () => {
    expect(memberPrivateEmailKeys("  user@example.com  ")).toEqual({
      pk: "member#private#user@example.com",
      sk: "member",
    });
    expect(memberMainKeys("member-id")).toEqual({ pk: "member#member-id", sk: "member" });
  });

  it("volunteer signup collection and id lookup keys", () => {
    expect(volunteerSignupCollectionKeys("evt", "shift", "signup")).toEqual({
      pk: "volunteerSignup#evt",
      sk: "shift#signup",
    });
    expect(volunteerSignupIdLookupKeys("signup")).toEqual({
      pk: "volunteerSignup#id#signup",
      sk: "volunteerSignup",
    });
  });
});
