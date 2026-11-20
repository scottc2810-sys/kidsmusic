import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpiderChart, type SpiderAxis } from "./SpiderChart";

const axes: SpiderAxis[] = [
  { id: "listen", label: "Listening", emoji: "👂", value: 90, before: 70, band: "Demonstrated mastery" },
  { id: "speak", label: "Speaking", emoji: "🗣️", value: null, band: null },
  { id: "read", label: "Reading", emoji: "📖", value: 45, before: 40, band: "Developing" },
  { id: "write", label: "Writing", emoji: "✍️", value: 20, before: null, band: "Introduction" },
];

describe("SpiderChart", () => {
  it("draws band rings, the now shape, the dashed 2-weeks-ago shape and a point per axis", () => {
    const html = renderToStaticMarkup(<SpiderChart title="Hindi" axes={axes} />);
    expect(html.match(/class="ring( rim)?"/g)?.length).toBe(5); // 20 40 60 80 100
    expect(html.match(/class="ring-label"/g)?.length).toBe(4);
    expect(html).toContain('class="shape now"');
    expect(html).toContain('class="shape before"');
    expect(html.match(/class="dot/g)?.length).toBe(4);
    expect(html).toContain("2 weeks ago");
  });

  it("shows an axis without evidence as 'not yet', never as a score", () => {
    const html = renderToStaticMarkup(<SpiderChart title="Hindi" axes={axes} />);
    expect(html).toContain('class="dot empty"');
    expect(html).toContain("Speaking not yet assessed");
    expect(html).toContain(">not yet<");
  });

  it("names every value in the accessible label, and hides numbers in the child's version", () => {
    const parent = renderToStaticMarkup(<SpiderChart title="Hindi" axes={axes} />);
    expect(parent).toContain("Listening 90, Speaking not yet assessed, Reading 45, Writing 20");
    const kid = renderToStaticMarkup(<SpiderChart kid title="Hindi" axes={axes} />);
    expect(kid).not.toContain(">90<");
    expect(kid).not.toContain("Show as table");
  });

  it("uses bars, not a broken shape, when there are fewer than 3 axes", () => {
    const html = renderToStaticMarkup(<SpiderChart title="Reading" axes={axes.slice(0, 1)} />);
    expect(html).toContain("spider-bar-fill");
    expect(html).not.toContain("<polygon");
  });
});
