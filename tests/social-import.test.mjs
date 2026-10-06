import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSocialProfileUrl, previewSocialImport } from "../src/socialImport.ts";

test("LinkedIn profile CSV and skills create a reviewable room look", () => {
  const preview = previewSocialImport({
    platform: "linkedin",
    url: "https://www.linkedin.com/in/alex-rivera/?trk=private",
    pastedText: "",
    files: [
      { name: "Profile.csv", text: 'First Name,Last Name,Headline,Summary,Email Address\nAlex,Rivera,"Ocean scientist, designer","I study marine life and build maps",private@example.com\n' },
      { name: "Skills.csv", text: "Name\nClimate modelling\nData visualization\n" },
    ],
  });
  assert.equal(preview.profile.displayName, "Alex Rivera");
  assert.equal(preview.profile.theme, "coastal");
  assert.equal(preview.profile.socialUrl, "https://www.linkedin.com/in/alex-rivera/");
  assert.match(preview.profile.interests, /Climate modelling/);
  assert.equal(JSON.stringify(preview).includes("private@example.com"), false);
  assert.deepEqual(preview.sources, ["Profile.csv", "Skills.csv"]);
});

test("X archive profile and posts yield interests without retaining raw posts", () => {
  const preview = previewSocialImport({
    platform: "x",
    url: "https://x.com/spacebuilder?ref=home",
    pastedText: "",
    files: [
      { name: "account.js", text: 'window.YTD.account.part0 = [{"account":{"accountDisplayName":"Space Builder","username":"spacebuilder"}}]' },
      { name: "profile.js", text: 'window.YTD.profile.part0 = [{"profile":{"description":{"bio":"Robotics and astronomy projects"}}}]' },
      { name: "tweets.js", text: 'window.YTD.tweets.part0 = [{"tweet":{"full_text":"Designing the next rover #SpaceDesign PRIVATE_POST_DETAIL"}}]' },
    ],
  });
  assert.equal(preview.profile.displayName, "Space Builder");
  assert.equal(preview.profile.theme, "cosmic");
  assert.match(preview.profile.interests, /SpaceDesign/);
  assert.equal(JSON.stringify(preview).includes("PRIVATE_POST_DETAIL"), false);
  assert.equal(preview.details.some((detail) => detail.includes("posts scanned")), true);
});

test("social import needs actual profile content and a matching platform URL", () => {
  assert.throws(() => previewSocialImport({ platform: "linkedin", url: "https://www.linkedin.com/in/example/", pastedText: "", files: [] }), /URL alone/);
  assert.throws(() => normalizeSocialProfileUrl("x", "https://evil.example/x/person"));
  assert.throws(() => normalizeSocialProfileUrl("linkedin", "https://www.linkedin.com/jobs/"));
  assert.throws(() => previewSocialImport({ platform: "x", url: "https://x.com/person", pastedText: "", files: [{ name: "direct-messages.js", text: "[]" }] }), /account.js/);
  const pasted = previewSocialImport({ platform: "x", url: "https://x.com/oceanmaker", pastedText: "I build marine science tools", files: [] });
  assert.equal(pasted.profile.theme, "coastal");
});
