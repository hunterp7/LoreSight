export type ServicePhase = "starting" | "ready" | "stopping";

export class ServiceReadiness {
  private phase: ServicePhase = "starting";

  markReady(): void {
    if (this.phase !== "starting") throw new Error(`Cannot become ready from ${this.phase}.`);
    this.phase = "ready";
  }

  markStopping(): void {
    this.phase = "stopping";
  }

  snapshot(): { ready: boolean; phase: ServicePhase } {
    return { ready: this.phase === "ready", phase: this.phase };
  }
}
