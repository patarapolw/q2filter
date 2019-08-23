import uuid from "uuid/v4";
import moment from "moment";

(moment as any).suppressDeprecationWarnings = true;

export interface IQParserOptions {
  dialect?: "mongo" | "filter";  // Default: mongo
  anyOf?: string[],
  isString?: string[];
  isDate?: string[];
  transforms?: {
    [expr: string]: (expr: string) => Record<string, any>;
  },
  filters?: {
    [expr: string]: (items: Record<string, any>[], expr: string) => Record<string, any>[];
  },
  noParse?: string[];
  sorter?: (sortBy?: string, desc?: boolean) => (a: Record<string, any>, b: Record<string, any>) => number;
  sortBy?: string;
  desc?: boolean;
}

export interface IQParserResult {
  sortBy?: string;
  desc?: boolean;
  cond: Record<string, any>;
  noParse: string[];
}

export default class QParser {
  private dialect: "mongo" | "filter";
  private sortBy?: string;
  private desc?: boolean;
  private noParse: string[] = [];

  private readonly anyOf: Set<string> | null;
  private readonly isString: Set<string> | null;
  private readonly isDate: Set<string> | null;
  private readonly transforms: Record<string, (expr: string) => Record<string, any>>;
  private readonly filters: {
    [expr: string]: (items: Record<string, any>[], expr: string) => Record<string, any>[];
  }
  private readonly sorter: (sortBy?: string, desc?: boolean) =>
  (a: Record<string, any>, b: Record<string, any>) => number;

  private default = {
    sortBy: null as string | null,
    desc: null as boolean | null,
    noParse: [] as string[]
  };

  constructor(options: IQParserOptions = {}) {
    const { dialect, anyOf, isString, isDate, transforms, filters, noParse, sorter, sortBy, desc} = options;

    this.dialect = dialect || "mongo";
    this.anyOf = anyOf ? new Set(anyOf) : null;
    this.isString = isString ? new Set(isString) : null;
    this.isDate = isDate ? new Set(isDate) : null;
    this.transforms = transforms || {};
    this.filters = filters || {};    
    this.sorter = sorter || anySorter;

    this.default.sortBy = sortBy || null;
    this.default.desc = desc !== undefined ? desc : null;

    this.default.noParse = noParse || [];
    this.default.noParse.push(...Object.keys(this.filters));
  }

  public filter(items: Record<string, any>[], q: string): Record<string, any>[] {
    const cond = this.getCond(q);

    if (this.sortBy) {
      items = items.sort(this.sorter(this.sortBy, getFirst({cmp: [this.desc], default: true})));
    } else if (this.default.sortBy) {
      items = items.sort(this.sorter(this.default.sortBy, getFirst({cmp: [this.default.desc], default: false})));
    }

    items = items.filter(this.condFilter(cond));

    for (const np of this.noParse) {
      const filterFn = this.filters[np];
      if (filterFn) {
        items = filterFn(items, np);
      }
    }

    return items;
  }

  public getCond(q: string): Record<string, any> {
    this.sortBy = undefined
    this.desc = undefined;
    this.noParse = [];

    return this._getCond(q);
  }

  public getCondFull(q: string): IQParserResult {
    return {
      cond: this.getCond(q),
      sortBy: this.sortBy,
      desc: this.desc,
      noParse: this.noParse
    };
  }

  private _getCond(q: string): Record<string, any> {
    q = q.trim();

    for (const method of [
      this.removeBrackets,
      this.parseSep(" OR "),
      this.parseSep(" "),
      this.parseNeg,
      this.parseFullExpr,
      this.parsePartialExpr
    ]) {
      try {
        return method.bind(this)(q);
      } catch (e) { }
    }

    return {};
  }

  private removeBrackets(q: string) {
    if (q[0] === "(" && q[q.length - 1] === ")") {
      return this._getCond(q.substr(1, q.length - 2));
    }

    throw new Error("Not bracketed");
  }

  private parseSep(sep: string) {
    return (q: string) => {
      const brackets: any = {};

      q = q.replace(/\([^)]+\)/g, (p0) => {
        const id = uuid();
        brackets[id] = p0;
        return id;
      });
      const tokens = q.split(sep);
      tokens.forEach((t, i) => {
        for (const k of Object.keys(brackets)) {
          tokens[i] = tokens[i].replace(k, brackets[k]);
        }
      });

      if (tokens.length >= 2) {
        const parsedTokens = tokens.map((t) => this._getCond(t)).filter((t) => t && Object.keys(t).length > 0);
        if (parsedTokens.length > 1) {
          return { [sep === " OR " ? "$or" : "$and"]: parsedTokens };
        } else {
          return parsedTokens[0] || {};
        }
      }

      throw new Error(`Not separated by '${sep}'`);
    }
  }

  private parseNeg(q: string) {
    if (q[0] === "-") {
      const sb = "-sortBy:";
      if (q.startsWith(sb) && q !== sb) {
        this.desc = true;
        this.sortBy = q.substr(sb.length);
        return {};
      }

      return { $not: this._getCond(q.substr(1)) };
    }

    throw new Error("Not negative");
  }

  private parseFullExpr(q: string) {
    const m = /^([\w-]+)(:|~|[><]=?|=)([\S-]+|"[^"]+")$/.exec(q);
    if (m) {
      let [m0, k, op, v]: any[] = m;

      const transformFn = this.transforms[m0];
      if (transformFn) {
        return transformFn(m0);
      }

      if (this.default.noParse.includes(m0)) {
        this.noParse.push(m0);
        return {};
      }

      if (v.length > 2 && v[0] === '"' && v[v.length - 1] === '"') {
        v = v.substr(1, v.length - 2);
      } else {
        const m1 = /^\d+(?:\.\d+)?$/.exec(v);
        if (m1) {
          v = parseFloat(v);
        }
      }

      if (k === "sortBy") {
        this.desc = false;
        this.sortBy = v;
        return {};
      }

      if (op === ":") {
        if (k === "due" || k === "nextReview") {
          k = "nextReview";
          v = "<="
        } else if (k === "created" || k === "modified") {
          v = "<=";
        }
      }

      if (v === "NULL") {
        if (this.dialect === "mongo") {
          return { $or: [
            { [k]: null },
            { [k]: "" },
            { [k]: {$exists: false} }
          ] };
        } else {
          return { [k]: { $exists: false } };
        }
      }

      if (this.isDate && this.isDate.has(k)) {
        if (v === "NOW") {
          v = new Date();
        } else if (typeof v === "string") {
          const m1 = /^([-+]\d+)(\S+)$/.exec(v);
          let isMomentParsed = false;
          if (m1) {
            try {
              v = moment().add(parseInt(m1[1]), m1[2] as any).toDate();
              isMomentParsed = true;
            } catch (e) { }
          }

          if (!isMomentParsed) {
            v = toDateOrDefault(v);
          }
        }
      }

      if (v) {
        if (op === ":") {
          if (typeof v === "string" || (this.isString && this.isString.has(k))) {
            if (this.dialect === "mongo") {
              v = { $regex: escapeRegExp(v) };
            } else {
              v = { $substr: v };
            }
          }
        } else if (op === "~") {
          v = { $regex: v.toString() };
        } else if (op === ">=") {
          v = { $gte: v };
        } else if (op === ">") {
          v = { $gt: v }
        } else if (op === "<=") {
          v = { $lte: v };
        } else if (op === "<") {
          v = { $lt: v };
        }
      }

      return { [k]: v };
    }

    throw new Error("Not full expression");
  }


  private parsePartialExpr(q: string) {
    if (q && q.indexOf(":") === -1) {
      const orCond: any[] = [];

      if (this.anyOf) {
        for (const a of this.anyOf) {
          if (this.isString && this.isString.has(a)) {
            let v: any;
            if (this.dialect === "mongo") {
              v = { $regex: escapeRegExp(q) };
            } else {
              v = { $substr: q };
            }
            orCond.push({ [a]: v });
          } else {
            orCond.push({ [a]: q });
          }
        }
      } else {
        let v: any;
        if (this.dialect === "mongo") {
          v = { $regex: escapeRegExp(q) };
        } else {
          v = { $substr: q };
        }
        return {"*": v}
      }

      if (orCond.length > 1) {
        return { $or: orCond };
      } else if (orCond.length === 1) {
        return orCond[0];
      }

      return {};
    }

    throw new Error("Not partial expression");
  }

  private condFilter(cond: any) {
    return (item: Record<string, any>): boolean => {
      for (let [k, v] of Object.entries<any>(cond)) {
        if (k[0] === "$") {
          if (k === "$and") {
            return v.every((x: Record<string, any>) => this.condFilter(x)(item));
          } else if (k === "$or") {
            return v.some((x: Record<string, any>) => this.condFilter(x)(item));
          } else if (k === "$not") {
            return !this.condFilter(v)(item);
          }
        } else {
          let itemK = dotGetter(item, k);

          if (this.isDate && this.isDate.has(k)) {
            itemK = toDateOrDefault(itemK);
          }
  
          if (v && v.constructor === {}.constructor
            && Object.keys(v).some((k0) => k0[0] === "$")) {

            return (() => {
              for (const op of Object.keys(v)) {
                try {
                  if (op === "$regex") {
                    if (Array.isArray(itemK)) {
                      const r = new RegExp(v[op].toString(), "i");
                      return itemK.some((el) => r.test(el));
                    } else {
                      return new RegExp(v[op].toString(), "i").test(itemK);
                    }
                  } else if (op === "$startswith") {
                    if (Array.isArray(itemK)) {
                      return itemK.some((el) => el.startsWith(v[op]));
                    } else {
                      return itemK.startsWith(v[op]);
                    }
                  } else if (op === "$substr") {
                    if (Array.isArray(itemK)) {
                      return itemK.some((el: string) => el.includes(v[op]));
                    } else {
                      return itemK.includes(v[op]);
                    }
                  } else if (op === "$exists") {
                    return (itemK === null || itemK === undefined || itemK === "") !== v[op];
                  } else {
                    let v1 = toDateOrDefault(itemK);
                    let v2 = toDateOrDefault(v[op]);

                    let canCompare = false;
  
                    if (typeof v1 === "object" && typeof v2 === "object") {
                      if (v1.constructor === v2.constructor) {
                        canCompare = true;
                      }
                    } else {
                      canCompare = (typeof v1 === typeof v2);
                    }

                    if (canCompare) {
                      if (op === "$gte") {
                        return v1 >= v2;
                      } else if (op === "$gt") {
                        return v1 > v2;
                      } else if (op === "$lte") {
                        return v1 <= v2;
                      } else if (op === "$lt") {
                        return v1 < v2;
                      }
                    }
                  }
                } catch (e) { }
              }
              return false;
            })();
          } else if (Array.isArray(itemK)) {
            if (!itemK.includes(v)) {
              return false;
            }
          } else if (itemK !== v) {
            return false;
          }
        }
      }
  
      return true;
    }
  }
}

export function dotGetter(d: any, k: string) {
  let v = d;
  for (const kn of k.split(".")) {
    if (v && v.constructor === {}.constructor) {
      if (kn === "*") {
        v = Object.values(v);
      } else {
        v = v[kn];
        if (v === undefined) {
          v = {};
        }
      }
    } else if (Array.isArray(v)) {
      try {
        v = v[parseInt(kn)];
        if (v === undefined) {
          v = null;
          break;
        }
      } catch (e) {
        v = null;
        break;
      }
    }
  }

  if (v && v.constructor === {}.constructor && Object.keys(v).length === 0) {
    v = null;
  }

  return v;
}

export function anySorter(sortBy?: string, desc?: boolean) {
  return (a: any, b: any) => {
    if (!sortBy) {
      return 0;
    }

    const m = a[sortBy];
    const n = b[sortBy];

    if (typeof m === typeof n) {
      if (typeof m === "string") {
        return desc ? n.localeCompare(m) : m.localeCompare(n);
      } else if (typeof m === "number") {
        return desc ? n - m : m - n;
      } else {
        return 0;
      }
    } else {
      const typeDict = {
        "number": 1,
        "string": 2,
        "object": 3
      } as any;

      const tM = typeDict[typeof m] || -1;
      const tN = typeDict[typeof n] || -1;

      return desc ? tN - tM : tM - tN;
    }
  }
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');  // $& means the whole matched string
}

export function toDateOrDefault(s: any) {
  try {
    if (s) {
      const m = moment(s);
      if (m.isValid()) {
        s = m.toDate();
      }
    }
  } catch (e) { }

  return s;
}

/**
 * Because a || b || c || default doesn't always work as expected.
 * @param options 
 */
export function getFirst(options: {
  cmp: any[],
  default?: any,
  nil?: any[]
}) {
  options.nil = options.nil || [undefined];
  for (const c of options.cmp) {
    if (!options.nil.includes(c)) {
      return c;
    }
  }
  return options.default;
}