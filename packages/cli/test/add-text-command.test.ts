import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { registerAddTextCommand } from "../src/commands/add-text.js";

describe("add-text command", () => {
  it("defaults to yellow text for thumbnail-style overlays", () => {
    const program = new Command();
    registerAddTextCommand(program);

    const addText = program.commands.find((command) => command.name() === "add-text");
    const color = addText?.options.find((option) => option.long === "--color");

    expect(color?.defaultValue).toBe("#FFE600");
  });

  it("defaults to a heavy italic thumbnail style", () => {
    const program = new Command();
    registerAddTextCommand(program);

    const addText = program.commands.find((command) => command.name() === "add-text");
    const weight = addText?.options.find((option) => option.long === "--weight");
    const italic = addText?.options.find((option) => option.long === "--italic");

    expect(weight?.defaultValue).toBe("900");
    expect(italic?.defaultValue).toBe("true");
  });
});
