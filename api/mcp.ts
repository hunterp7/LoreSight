import type { IncomingMessage, ServerResponse } from "node:http";
import { handleNodeRequest } from "../server/src/index.js";

export default function mcp(req: IncomingMessage, res: ServerResponse) {
  // Vercel's Node framework uses this entrypoint for the whole service.
  // Normalize explicit function aliases without swallowing public routes.
  if (req.url) {
    const url = new URL(req.url, "http://vercel.local");
    if (["/api/mcp", "/api/health", "/api/ready"].includes(url.pathname)) {
      req.url = `${url.pathname.slice(4)}${url.search}`;
    }
  }
  return handleNodeRequest(req, res);
}
