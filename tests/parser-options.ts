import { IQParserOptions } from "../src/index";
import stringify from "es6-json-stable-stringify";

export function getParserOptions(dialect?: "mongo" | "filter"): IQParserOptions {
  return {
    dialect,
    anyOf: ["a", "b", "s", "tag"],
    isString: ["s", "tag"],
    isDate: ["date"],
    noParse: ["is:special"],
    transforms: {
      "is:due": () => {
        return {nextReview: {$lt: new Date()}}
      }
    },
    filters: {
      "is:distinct": (items: any[]) => {
        const col: Record<string, any> = {};
        for (const it of items) {
          const k = stringify(it);
          if (!col[k]) {
            col[k] = it;
          }
        }
        return Object.values(col);
      },
      "is:duplicate": (items: any[]) => {
        const col: Record<string, any[]> = {};
        for (const it of items) {
          const k = stringify(it);
          col[k] = col[k] || [];
          col[k].push(it);
        }
        return Object.values(col).filter((a) => a.length > 1).reduce((a, b) => [...a, ...b], []);
      }
    }
  }
}