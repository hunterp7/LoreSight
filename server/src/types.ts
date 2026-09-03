export type Stage =
  | "orientation"
  | "memory_review"
  | "investigation"
  | "resolution"
  | "complete";

export type IntakeAction =
  | "confirm_alive"
  | "express_uncertainty"
  | "refuse_status"
  | "deny_previous_life"
  | "admit_dejavu"
  | "request_personnel_file";

export type EndingId = "retain_life" | "return_life" | "join_agency";

export type ArtifactId =
  | "personnel-a17"
  | "elevator-1974"
  | "childhood-kit"
  | "original-assignee";

export interface Artifact {
  id: ArtifactId;
  type: "record" | "log" | "product" | "memorandum";
  title: string;
  subtitle: string;
  summary: string;
  body: string[];
  stamp?: string;
  visual?: {
    assetKey: string;
    altText: string;
    caption: string;
  };
  visible: boolean;
  examined: boolean;
}

export interface Ending {
  id: EndingId;
  title: string;
  disposition: string;
  caseworkerLine: string;
  certificate: string;
}

export interface GameState {
  playerId: string;
  applicantNumber: string;
  stage: Stage;
  stateVersion: number;
  caseworkerLine: string;
  objective: string;
  responses: Array<{ action: IntakeAction; playerWords?: string }>;
  artifacts: Artifact[];
  ending?: Ending;
  startedAt: string;
}

export interface PublicGameState extends GameState {
  progress: number;
  availableActions: string[];
}
