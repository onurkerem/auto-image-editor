import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { registerRemoveBgCommand } from "../src/commands/remove-bg.js";

describe("remove-bg command", () => {
  it("registers the remove-bg subcommand with options", () => {
    const program = new Command();
    registerRemoveBgCommand(program);

    const removeBg = program.commands.find((command) => command.name() === "remove-bg");
    expect(removeBg).toBeDefined();

    const input = removeBg?.options.find((option) => option.long === "--input");
    const output = removeBg?.options.find((option) => option.long === "--output");
    const bg = removeBg?.options.find((option) => option.long === "--bg");
    const tolerance = removeBg?.options.find((option) => option.long === "--tolerance");

    expect(input?.mandatory).toBe(true);
    expect(output?.mandatory).toBe(true);
    expect(bg?.mandatory).toBeFalsy();
    expect(bg?.required).toBe(true);
    expect(tolerance?.defaultValue).toBe("15");
  });
});
