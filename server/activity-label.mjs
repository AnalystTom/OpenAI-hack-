/** Return only a coarse activity label. Source arguments never leave the parser. */
export function toolActivityLabel(name, input) {
  let command = "", code = "";
  if (typeof input === "string") {
    try {
      const args = JSON.parse(input);
      command = typeof args?.cmd === "string" ? args.cmd : typeof args?.command === "string" ? args.command : "";
      code = typeof args?.code === "string" ? args.code : "";
    } catch { code = input; }
  }
  if (/apply_patch|edit_file|write_file/.test(name) || /tools\.apply_patch\s*\(/.test(code)) return "Editing project files";
  if (/playwright|browser_|view_image/.test(name) || /tools\.[\w]*playwright/.test(code)) return "Checking the browser";
  if (/read_thread|list_threads/.test(name)) return "Reading session activity";
  if (/web__run|search_query/.test(name)) return "Researching sources";
  if (/wait|write_stdin/.test(name)) return "Waiting for tool results";
  if (!command && /tools\.exec_command\s*\(/.test(code))
    command = code.match(/\b(?:cmd|command)["']?\s*:\s*["']([^"']+)/)?.[1] ?? "";
  if (/\b(?:npm|pnpm|yarn) (?:run )?(?:test|vitest)\b|\bpytest\b|\bnode\b[^\n]*--test/.test(command)) return "Running tests";
  if (/\b(?:npm|pnpm|yarn) run build\b|\btsc\b/.test(command)) return "Checking the build";
  if (/^(?:rg|cat|sed|ls|git (?:diff|show|status))\b/.test(command.trim()) || /read_file|search_files/.test(name)) return "Inspecting project files";
  return "Using tools";
}
