import { describe, expect, it } from "vitest";
import { parseFilter } from "@/window/dialogs";

describe("parseFilter", () => {
  it("returns undefined for empty input", () => {
    expect(parseFilter()).toBeUndefined();
    expect(parseFilter("")).toBeUndefined();
  });

  it("parses a Windows-style filter string", () => {
    expect(parseFilter("All files (*.*)|*.*")).toEqual([{ name: "All files", extensions: ["*"] }]);
  });

  it("parses multiple filter pairs", () => {
    expect(parseFilter("Text files (*.txt)|*.txt|Images (*.png;*.jpg)|*.png;*.jpg")).toEqual([
      { name: "Text files", extensions: ["txt"] },
      { name: "Images", extensions: ["png", "jpg"] },
    ]);
  });

  it("returns undefined for malformed input", () => {
    expect(parseFilter("nope")).toBeUndefined();
  });
});
