import type { PlayerArtifactView, StoryframePlayerView } from "./types";

export const demoView: StoryframePlayerView = {
  audience: "player",
  session: {
    id: "local-preview",
    worldId: "agency.applicant-intake",
    worldVersion: "1.0.0",
    stateVersion: 0,
    status: "active",
  },
  presentation: {
    worldTitle: "LoreSight Sample",
    identityLabel: "A message for you",
    identityValue: "71-442-00077",
    layout: "focus",
    stageLabel: "Getting started",
    stepLabel: "Step 1 of 2",
    headline: "Before we begin",
    speakerLine: "Hello. We found a problem in your file. First: are you alive?",
    objective: "Choose the closest answer.",
    progress: 8,
    atmosphere: "Something does not match · Your case is open",
    footer: "Take your time.",
    frame: { kind: "default-crt" },
  },
  availableIntents: [
    { id: "confirm_alive", title: "Yes, I’m here", description: "Confirm that you are alive.", kind: "primary" },
    { id: "express_uncertainty", title: "I’m not sure", description: "Say that the answer is not simple.", kind: "primary" },
    { id: "refuse_status", title: "I won’t answer", description: "Refuse the classification question.", kind: "primary" },
  ],
  artifacts: [],
};

const artifactCatalog: PlayerArtifactView[] = [
  {
    id: "personnel-a17", kind: "record", title: "Personnel Record A-17", shortTitle: "Work history",
    summary: "Your applicant number appears on placements beginning before your birth.",
    body: ["PLACEMENT 04-113 — textile assistant, 1911–1918 — concluded normally.", "PLACEMENT 22-980 — regional child, 1974–1987 — memories not fully recovered.", "Case note: Applicant continues to confuse chronological order with ownership."],
    stamp: "PREVIOUS EXPERIENCE REQUIRED", reviewed: false,
  },
  {
    id: "elevator-1974", kind: "log", title: "Elevator Transit Log", shortTitle: "Elevator log",
    summary: "The elevator recorded your arrival decades before your current life began.",
    body: ["08:14 — Applicant exited Childhood Assembly, 1974.", "08:15 — Maintenance requested removal of duplicate applicant.", "08:16 — Request closed: duplicates improve throughput."],
    stamp: "OPERATING AS INTENDED", reviewed: false,
    visual: { assetKey: "agency.elevator-transit-overlay", altText: "A vertical elevator route diagram shows the applicant entering the lobby, stopping at Childhood Assembly 1974, and returning one minute later under a duplicate-applicant warning.", caption: "Car 6 transit overlay / chronology normalized", textLines: ["+-- TRANSIT TRACE / ELEVATOR-1974 --+", "| 08:14  [ LOBBY ENTRY ]            |", "|              +----> [ 1974 ]       |", "|                    ! DUPLICATE     |", "| 08:15  [ LOBBY RETURN ]           |", "+------------------------------------+"] },
  },
  {
    id: "childhood-kit", kind: "product", title: "Childhood Starter Kit", shortTitle: "Childhood notes",
    summary: "A discontinued product review describes memories belonging to your file.",
    body: ["Includes one supportive adult, two minor disappointments, six years of weather, and a recurring hallway dream.", "VERIFIED REVIEW: ‘Mine included memories of a brother. I was assigned as an only child.’", "AGENCY RESPONSE: ‘Thank you. The brother has been removed.’"],
    stamp: "FRIENDS SOLD SEPARATELY", reviewed: false,
  },
  {
    id: "original-assignee", kind: "memorandum", title: "Original Assignee Memorandum", shortTitle: "Final note",
    summary: "Your current life was issued to another applicant who is still waiting.",
    body: ["Applicant 71-442-B completed orientation and was approved for the current placement.", "Applicant B remains in Waiting Room 3. Estimated wait: one complete human lifetime.", "Handwritten below: ‘Do not let them process either of you.’"],
    stamp: "NO ACTION REQUIRED IMMEDIATELY", reviewed: false,
  },
];

export function localIntent(view: StoryframePlayerView, intentId: string): StoryframePlayerView {
  const next = structuredClone(view);
  if (intentId === "confirm_alive" || intentId === "express_uncertainty" || intentId === "refuse_status") {
    const speakerLine = intentId === "confirm_alive"
      ? "Good. One more question: do your childhood memories feel like yours?"
      : intentId === "express_uncertainty"
        ? "That is okay. One more question: do your childhood memories feel like yours?"
        : "We can leave that unanswered. Do your childhood memories feel like yours?";
    next.presentation = { ...next.presentation, stageLabel: "One more question", stepLabel: "Step 2 of 2", headline: "One simple question", speakerLine, objective: "Choose the closest answer.", progress: 20 };
    next.availableIntents = [
      { id: "admit_dejavu", title: "Yes, mostly", description: "Say that your memories mostly feel like yours.", kind: "primary" },
      { id: "deny_previous_life", title: "Not all of them", description: "Say that some memories feel unfamiliar.", kind: "primary" },
      { id: "request_personnel_file", title: "Show me the file", description: "Ask to see the record directly.", kind: "primary" },
    ];
  } else if (intentId === "admit_dejavu" || intentId === "deny_previous_life" || intentId === "request_personnel_file") {
    next.presentation = { ...next.presentation, identityLabel: "Your case", layout: "investigation", stageLabel: "Looking for answers", stepLabel: "Right now", headline: "We found something that does not match", speakerLine: "Thank you. We found three things that do not match. Start with the first.", objective: "Open the first clue.", progress: 35 };
    next.artifacts = structuredClone(artifactCatalog.slice(0, 3));
    next.availableIntents = next.artifacts.map((artifact) => ({ id: `examine_${artifact.id.replace(/-/g, "_")}`, title: `Open ${artifact.shortTitle}`, description: artifact.summary, kind: "inspect" as const, artifactId: artifact.id }));
  } else if (intentId.startsWith("examine_")) {
    const artifactId = Object.entries({ personnel_a17: "personnel-a17", elevator_1974: "elevator-1974", childhood_kit: "childhood-kit", original_assignee: "original-assignee" })
      .find(([suffix]) => intentId === `examine_${suffix}`)?.[1];
    const artifact = next.artifacts.find((item) => item.id === artifactId);
    if (artifact) artifact.reviewed = true;
    next.availableIntents = next.availableIntents.filter((intent) => intent.id !== intentId);
    const initialComplete = next.artifacts.slice(0, 3).every((item) => item.reviewed);
    if (initialComplete && !next.artifacts.some((item) => item.id === "original-assignee")) {
      const finalArtifact = structuredClone(artifactCatalog[3]);
      next.artifacts.push(finalArtifact);
      next.availableIntents.push({ id: "examine_original_assignee", title: "Open final note", description: finalArtifact.summary, kind: "inspect", artifactId: finalArtifact.id });
      next.presentation = { ...next.presentation, speakerLine: "We found one final note. It says this life may have been meant for someone else.", objective: "Open the final clue." };
    } else if (artifact?.id === "original-assignee") {
      next.presentation = { ...next.presentation, layout: "decision", stageLabel: "Your decision", headline: "You decide what happens next", speakerLine: "That is everything. Now you decide what happens to this life.", objective: "Choose what happens next.", progress: 90 };
      next.availableIntents = [
        { id: "retain_life", title: "Keep my life", description: "Continue as you are.", kind: "decision" },
        { id: "return_life", title: "Give it back", description: "Let the other person have it.", kind: "decision" },
        { id: "join_agency", title: "Stay here", description: "Accept a position inside the system.", kind: "decision" },
      ];
    }
  } else if (intentId === "retain_life" || intentId === "return_life" || intentId === "join_agency") {
    next.session.status = "complete";
    const headline = intentId === "retain_life"
      ? "Notice of Continued Existence"
      : intentId === "return_life"
        ? "Voluntary Placement Surrender"
        : "Internal Candidate Appointment";
    next.presentation = { ...next.presentation, layout: "complete", stageLabel: "Complete", stepLabel: "Complete", headline, speakerLine: "Thank you. Your decision has been filed somewhere permanent.", objective: "Retain this record for all future lives.", progress: 100 };
    next.availableIntents = [];
    next.ending = {
      title: next.presentation.headline,
      disposition: intentId === "retain_life"
        ? "Current occupant retained despite documented irregularities."
        : intentId === "return_life"
          ? "Current assignment returned to its intended recipient."
          : "Applicant reassigned as Junior Continuity Clerk.",
      certificate: "Existence may continue until recalled.",
    };
  }
  next.session.stateVersion += 1;
  if (next.presentation.layout === "investigation") next.presentation.progress = Math.min(96, 35 + next.artifacts.filter((item) => item.reviewed).length * 13);
  return next;
}
