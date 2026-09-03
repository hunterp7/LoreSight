# LoreSight creation and remix handoff

## Create a new story

The **Imagine a new story** action is intentionally conversational in a
ChatGPT host. The widget sends a `ui/message` through the MCP Apps bridge
(`App.sendMessage`) with a short intake contract. The host should ask one
question at a time and collect:

1. premise;
2. setting;
3. protagonist;
4. tone;
5. approximate length; and
6. content boundaries.

The host summarizes the resulting brief and asks for confirmation before
creating a playable draft. `window.openai.sendFollowUpMessage` is supported as
the compatibility path for older ChatGPT hosts. A local event opens the
existing CRT form when no host bridge is available, so localhost preview and
non-ChatGPT MCP Apps hosts remain usable.

This is a fully generative flow and must not request a Z-machine binary. Any
future generation tool should accept the confirmed structured brief, validate
it server-side, and return a generic LoreSight story draft/session.

## Remix a story

Remix requires a source. The widget now makes the catalog path explicit:

- **Choose from story library** reveals a required story selector populated from
  the playable catalog.
- **Upload a file** reveals the local `.z3`, `.z4`, `.z5`, `.z8`, `.zblorb`,
  `.blorb`, or `.blb` picker.

Submitting the catalog path emits `loresight:remix-story` with `storyId`,
`title`, `format`, and `sourceUrl`, plus the requested change. This gives the
host enough structured context to continue the remix conversation without
silently launching the original story. Uploads remain local to the widget
until a user explicitly chooses a host file action.

## Native Apps contract

The implementation follows the current Apps SDK guidance: use MCP Apps
`ui/message` first, feature-detect ChatGPT bridge extensions, and preserve a
local fallback. See [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
and [the component bridge reference](https://developers.openai.com/plugins/reference#windowopenai-component-bridge).
