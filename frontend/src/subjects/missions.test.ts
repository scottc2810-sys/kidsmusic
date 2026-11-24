import { expect, it } from "vitest";
import { TOPICS } from "./index";
import { MISSIONS, missionFor } from "./missions";

it("every money and Vedas & wisdom topic ends with a real-life mission in the child's name", () => {
  const ids = [...TOPICS.finance, ...TOPICS.vedas].map((t) => t.id);
  expect(ids.filter((id) => !MISSIONS[id])).toEqual([]);
  expect(Object.keys(MISSIONS).filter((id) => !ids.includes(id))).toEqual([]); // no mission for a topic that is gone
  expect(missionFor("three_jars", "Asha")).toMatch(/^Asha, /);
  expect(missionFor("addition", "Asha")).toBeNull();
});
