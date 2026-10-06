import { useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowUpRight, Check, FileUp, Sparkles } from "lucide-react";
import {
  previewSocialImport, type SocialImportFile, type SocialImportPreview, type SocialPlatform,
} from "../socialImport";
import type { RoomProfile } from "../socialRoom";

function platformFor(url: string): SocialPlatform {
  try { return /^(x|twitter)\.com$|^www\.(x|twitter)\.com$/i.test(new URL(url).hostname) ? "x" : "linkedin"; }
  catch { return "linkedin"; }
}

export default function SocialImporter({ profile, onApply }: {
  profile: RoomProfile;
  onApply: (profile: RoomProfile, platform: SocialPlatform) => void;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>(() => profile.socialUrl ? platformFor(profile.socialUrl) : "linkedin");
  const [url, setUrl] = useState(profile.socialUrl);
  const [pastedText, setPastedText] = useState("");
  const [files, setFiles] = useState<SocialImportFile[]>([]);
  const [preview, setPreview] = useState<SocialImportPreview | null>(null);
  const [error, setError] = useState("");

  function choosePlatform(value: SocialPlatform) {
    setPlatform(value);
    setUrl("");
    setPastedText("");
    setFiles([]);
    setPreview(null);
    setError("");
  }
  async function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    setError(""); setPreview(null);
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (chosen.length > 5 || chosen.reduce((size, file) => size + file.size, 0) > 8_000_000)
      return setError("Choose up to five profile files, 8 MB total.");
    try { setFiles(await Promise.all(chosen.map(async (file) => ({ name: file.name, text: await file.text() })))); }
    catch { setError("Unable to read those files. Try pasting your profile text instead."); }
  }
  function makePreview(event: FormEvent) {
    event.preventDefault();
    try { setPreview(previewSocialImport({ platform, url, pastedText, files })); setError(""); }
    catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : "Unable to read that profile."); }
  }
  return <div className="studio-form social-import">
    <div className="social-import-heading"><Sparkles size={19} /><div><b>Import your social profile</b><small>Shape the room from information you choose to provide.</small></div></div>
    <div className="social-platforms" role="group" aria-label="Social platform">
      <button type="button" className={platform === "linkedin" ? "active" : ""} onClick={() => choosePlatform("linkedin")}>LinkedIn</button>
      <button type="button" className={platform === "x" ? "active" : ""} onClick={() => choosePlatform("x")}>X</button>
    </div>
    <form onSubmit={makePreview}>
      <label>{platform === "linkedin" ? "LinkedIn profile URL" : "X profile URL"}<input type="url" placeholder={platform === "linkedin" ? "https://www.linkedin.com/in/your-name/" : "https://x.com/yourhandle"} value={url} onChange={(event) => { setUrl(event.target.value); setPreview(null); }} /></label>
      <p className="field-note">The URL identifies your profile. Add your bio or selected export files to personalize the room; the URL by itself does not reveal profile data.</p>
      <label>Paste your public bio or headline<textarea rows={3} maxLength={2500} placeholder={platform === "linkedin" ? "Your headline, about section, and interests" : "Your bio and topics you often post about"} value={pastedText} onChange={(event) => { setPastedText(event.target.value); setPreview(null); }} /></label>
      <label className="social-file-pick"><FileUp size={17} /><span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected: ${files.map((file) => file.name).join(", ")}` : platform === "linkedin" ? "Choose LinkedIn profile CSV files" : "Choose X profile archive files"}</span><input type="file" multiple accept={platform === "linkedin" ? ".csv,text/csv" : ".js,.json,application/json"} onChange={chooseFiles} /></label>
      <p className="field-note">{platform === "linkedin" ? "Use Profile.csv, Skills.csv, Positions.csv, or Projects.csv from your data export." : "Use account.js, profile.js, or tweets.js from your X archive."} Only the profile fields and topic signals are kept in your room; the files stay in this browser session.</p>
      <div className="social-import-actions"><a href={platform === "linkedin" ? "https://www.linkedin.com/help/linkedin/answer/a1339364/" : "https://help.x.com/en/managing-your-account/how-to-download-your-x-archive"} target="_blank" rel="noreferrer">How to get my data <ArrowUpRight size={13} /></a><button className="import-button" type="submit"><Sparkles size={15} /> Preview room look</button></div>
    </form>
    {error && <p className="social-import-error" role="alert">{error}</p>}
    {preview && <div className={`social-preview social-preview-${preview.profile.theme}`}>
      <span>YOUR ROOM PREVIEW · {preview.platform === "linkedin" ? "LINKEDIN" : "X"}</span>
      <h3>{preview.profile.displayName}</h3>
      <p>{preview.profile.interests}</p>
      <small>{preview.profile.theme} theme · {preview.sources.join(", ") || "Pasted text"}{preview.details.length ? ` · ${preview.details.join(" · ")}` : ""}</small>
      <button className="import-button" onClick={() => onApply(preview.profile, preview.platform)}><Check size={15} /> Use this look</button>
    </div>}
  </div>;
}
