export default class BaseExporter {
  constructor(protected bytecode) {}

  /**
   * Internal method for visiting every timeline and applying a callback to it.
   */
  protected visitAllTimelines(callback: (timeline: any) => void) {
    for (const timelineId in this.bytecode.timelines) {
      for (const haikuId in this.bytecode.timelines[timelineId]) {
        if (/^__/.test(haikuId)) {
          continue;
        }
        callback(this.bytecode.timelines[timelineId][haikuId]);
      }
    }
  }

  /**
   * Internal method for visiting every timeline property and applying a callback to it.
   */
  protected visitAllTimelineProperties(callback: (timeline: any, property: string) => void) {
    this.visitAllTimelines((timeline) => {
      for (const property in timeline) {
        callback(timeline, property);
      }
    });
  }
}