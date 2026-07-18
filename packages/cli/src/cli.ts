#!/usr/bin/env node
import { Command } from "commander";
import { registerAddTextCommand } from "./commands/add-text.js";
import { registerRemoveBgCommand } from "./commands/remove-bg.js";

const program = new Command();

program
  .name("auto-image-editor")
  .description("CLI tool for adding text overlays to images")
  .version("1.1.0");

registerAddTextCommand(program);
registerRemoveBgCommand(program);

program.parse();
