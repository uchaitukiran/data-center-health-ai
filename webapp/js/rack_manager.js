/**
 * Rack State and Real-time Telemetry Coordinator
 * Synchronizes 3D mesh illumination and cache with WebSocket updates.
 */

export class RackManager {
  constructor(sceneEngine) {
    this.sceneEngine = sceneEngine;
    this.racksData = new Map();
  }

  updateRacks(rackStates) {
    if (!rackStates || !Array.isArray(rackStates)) return;

    rackStates.forEach(state => {
      this.racksData.set(state.rack_id, state);
      this.sceneEngine.updateRackTelemetry(state);
    });
  }

  getRackData(rackId) {
    return this.racksData.get(rackId) || null;
  }

  getAllRacks() {
    return Array.from(this.racksData.values());
  }
}
