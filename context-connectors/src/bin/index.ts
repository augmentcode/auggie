#!/usr/bin/env node
/**
 * CLI entry point for context-connectors
 */

import { Command } from "commander";
import { indexCommand } from "./cmd-index.js";
import { syncCommand } from "./cmd-sync.js";
import { searchCommand } from "./cmd-search.js";
import { listCommand } from "./cmd-list.js";
import { deleteCommand } from "./cmd-delete.js";
import { initCommand } from "./cmd-init.js";
import { mcpCommand } from "./cmd-mcp.js";
import { agentCommand } from "./cmd-agent.js";
import { mcpServeCommand } from "./cmd-mcp-serve.js";

const program = new Command();

program
  .name("context-connectors")
  .description("Index and search any data source with Augment's context engine")
  .version("0.1.0");

// Add subcommands
program.addCommand(indexCommand);
program.addCommand(syncCommand);
program.addCommand(searchCommand);
program.addCommand(listCommand);
program.addCommand(deleteCommand);
program.addCommand(initCommand);
program.addCommand(mcpCommand);
program.addCommand(mcpServeCommand);
program.addCommand(agentCommand);

program.parse();

