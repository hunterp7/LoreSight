import type { Artifact, Ending, EndingId } from "./types.js";

export const CASEWORKER = {
  welcome: "Hello. We found a problem in your file. First: are you alive?",
  alive: "Good. One more question: do your childhood memories feel like yours?",
  uncertain: "That is okay. One more question: do your childhood memories feel like yours?",
  refused: "We can leave that unanswered. Do your childhood memories feel like yours?",
  investigate: "Thank you. We found three things that do not match. Start with the first.",
  finalRecord: "We found one final note. It says this life may have been meant for someone else.",
  resolution: "That is everything. Now you decide what happens to this life.",
} as const;

export function createArtifacts(): Artifact[] {
  return [
    {
      id: "personnel-a17",
      type: "record",
      title: "Personnel Record A-17",
      subtitle: "Applicant history / partial",
      summary: "Your applicant number appears on placements beginning before your birth.",
      body: [
        "PLACEMENT 04-113 — textile assistant, 1911–1918 — concluded normally.",
        "PLACEMENT 22-980 — regional child, 1974–1987 — memories not fully recovered.",
        "PLACEMENT 71-442 — current assignment — issued to applicant pending verification.",
        "Case note: Applicant continues to confuse chronological order with ownership.",
      ],
      stamp: "PREVIOUS EXPERIENCE REQUIRED",
      visible: true,
      examined: false,
    },
    {
      id: "elevator-1974",
      type: "log",
      title: "Elevator Transit Log",
      subtitle: "Car 6 / unauthorized chronology",
      summary: "The elevator recorded your arrival decades before your current life began.",
      body: [
        "08:14 — Applicant entered lobby level.",
        "08:14 — Applicant exited Childhood Assembly, 1974.",
        "08:15 — Applicant entered lobby level.",
        "08:15 — Maintenance requested removal of duplicate applicant.",
        "08:16 — Maintenance request closed: duplicates improve throughput.",
      ],
      stamp: "ELEVATOR OPERATING AS INTENDED",
      visual: {
        assetKey: "agency.elevator-transit-overlay",
        altText:
          "A vertical elevator route diagram shows the applicant entering the lobby, briefly stopping at Childhood Assembly 1974, and returning to the lobby one minute later. A duplicate-applicant warning is stamped across the route.",
        caption: "Car 6 transit overlay / chronology normalized by Accident Prevention",
      },
      visible: true,
      examined: false,
    },
    {
      id: "childhood-kit",
      type: "product",
      title: "Childhood Starter Kit",
      subtitle: "Economy / ages 4–11",
      summary: "A discontinued product review describes memories belonging to your file.",
      body: [
        "Includes one supportive adult, two minor disappointments, six years of weather, and a recurring hallway dream.",
        "VERIFIED REVIEW: ‘Mine included memories of a brother. I was assigned as an only child.’",
        "AGENCY RESPONSE: ‘Thank you for contacting us. The brother has been removed.’",
        "Recall note: Batch 71-442 may contain memories licensed to another applicant.",
      ],
      stamp: "FRIENDS SOLD SEPARATELY",
      visible: true,
      examined: false,
    },
    {
      id: "original-assignee",
      type: "memorandum",
      title: "Original Assignee Memorandum",
      subtitle: "Accident Prevention / do not duplicate",
      summary: "Your current life was issued to another applicant who is still waiting.",
      body: [
        "Applicant 71-442-B completed orientation and was approved for the current placement.",
        "During transfer, Applicant 71-442-A entered the assignment through an unstaffed childhood memory.",
        "Applicant B remains in Waiting Room 3. Estimated wait: one complete human lifetime.",
        "Recommended correction: retrieve current occupant, restore intended employee, classify all resulting grief as onboarding.",
        "Handwritten below: ‘Do not let them process either of you.’",
      ],
      stamp: "NO ACTION REQUIRED IMMEDIATELY",
      visible: false,
      examined: false,
    },
  ];
}

const ENDINGS: Record<EndingId, Ending> = {
  retain_life: {
    id: "retain_life",
    title: "Notice of Continued Existence",
    disposition: "Current occupant retained despite documented irregularities.",
    caseworkerLine:
      "Your request to remain yourself has been provisionally approved. The Agency assumes no responsibility for recurring dreams, misplaced nostalgia, or contact from previous family members.",
    certificate:
      "Applicant has elected to retain the current identity. Ownership remains disputed. Existence may continue until recalled.",
  },
  return_life: {
    id: "return_life",
    title: "Voluntary Placement Surrender",
    disposition: "Current assignment returned to its intended recipient.",
    caseworkerLine:
      "Your generosity has been recorded as a processing error. Please proceed to Waiting Room 3, where an available childhood will be prepared while supplies last.",
    certificate:
      "Applicant surrendered the current identity without admitting that it was ever properly issued. Memories remain Agency property.",
  },
  join_agency: {
    id: "join_agency",
    title: "Internal Candidate Appointment",
    disposition: "Applicant reassigned as Junior Continuity Clerk.",
    caseworkerLine:
      "Congratulations. You have converted an existential complaint into a career opportunity. Your first task is to explain your disappearance to yourself.",
    certificate:
      "Applicant accepted employment in lieu of resolution. Benefits begin retroactively and may have caused the original discrepancy.",
  },
};

export function getEnding(id: EndingId): Ending {
  return ENDINGS[id];
}
