import fs from "fs";
import data from "./data.json";
import inputs from "./inputs.json";
import QParser from "../src/index";
import { getParserOptions } from "./parser-options";
import yaml, { DEFAULT_SAFE_SCHEMA } from "js-yaml";

const allExamples = ["mongo", "filter"].map((dialect) => {
  const p = new QParser(getParserOptions(dialect as any));
  const examples = inputs.map((ip) => {
    return {
      q: ip,
      cond: p.getCond(ip),
      fullCond: p.getCondFull(ip),
      filteredResults: JSON.parse(JSON.stringify(p.filter(data, ip)))
    };
  })

  return {
    dialect,
    examples
  }
});

fs.writeFileSync("tests/examples.yaml", 
yaml.dump(allExamples, {flowLevel: 5, schema: DEFAULT_SAFE_SCHEMA, skipInvalid: true}))
