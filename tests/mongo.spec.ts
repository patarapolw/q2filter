import inputs from "./inputs.json";
import QParser from "../src/index";
import { pp } from "./util";
import { getParserOptions } from "./parser-options";

describe("Dialect: Mongo", () => {
  describe("No options", () => {
    const p = new QParser();
  
    inputs.forEach((ip) => {
      it(`parse of '${ip}'`, () => {
        pp(p.getCondFull(ip));
      });
    });
  });
  
  describe("Base options", () => {
    const p = new QParser(getParserOptions("mongo"));
  
    inputs.forEach((ip) => {
      it(`parse of '${ip}'`, () => {
        pp(p.getCondFull(ip));
      });
    });
  });
})
