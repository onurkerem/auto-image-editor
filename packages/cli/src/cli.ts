#!/usr/bin/env node
import { Command } from "commander";
import { registerAddTextCommand } from "./commands/add-text.js";

const program = new Command();

program
  .name("auto-image-editor")
  .description("CLI tool for adding text overlays to images")
  .version("0.1.0");

registerAddTextCommand(program);

program.parse();
