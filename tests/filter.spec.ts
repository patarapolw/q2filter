import inputs from "./inputs.json";
import data from "./data.json";
import QParser from "../src/index";
import { pp } from "./util";
import { getParserOptions } from "./parser-options";

describe("Dialect: filter", () => {
  describe("Parse Only", () => {
    describe("No options", () => {
      const p = new QParser({dialect: "filter"});
    
      inputs.forEach((ip) => {
        it(`parse of '${ip}'`, () => {
          pp(p.getCondFull(ip));
        });
      });
    });
    
    describe("Base options", () => {
      const p = new QParser(getParserOptions("filter"));
    
      inputs.forEach((ip) => {
        it(`parse of '${ip}'`, () => {
          pp(p.getCondFull(ip));
        });
      });
    });
  });
  
  describe("filter", () => {
    const p = new QParser(getParserOptions("filter"));
  
    inputs.forEach((ip) => {
      it(`parse of '${ip}'`, () => {
        pp(p.filter(data, ip));
      });
    });
  
    // results.forEach(({q, output}) => {
    //   it(`result of '${q}'`, () => {
    //     assert.deepStrictEqual(p.filter(data, q), output);
    //   });
    // });
  });
  
  describe("filter mongo", () => {
    const p = new QParser(getParserOptions("mongo"));
  
    inputs.forEach((ip) => {
      it(`parse of '${ip}'`, () => {
        pp(p.filter(data, ip));
      });
    });
  
    // results.forEach(({q, output}) => {
    //   it(`result of '${q}'`, () => {
    //     assert.deepStrictEqual(p.filter(data, q), output);
    //   });
    // });
  });
})
