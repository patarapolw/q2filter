import uuid from "uuid/v4";
import moment from "moment";
import { toDate } from "valid-moment";

(moment as any).suppressDeprecationWarnings = true;

export interface ISortOptions {
  key: string,
  desc: boolean
}

export interface IQParserOptions<T> {
  /**
   * @default "mongo"
   */
  dialect: "mongo" | "extended";
  /**
   * @default "_id"
   */
  id: keyof T;
  anyOf?: string[];
  isString?: string[];
  isDate?: string[];
  noParse?: string[];
  transforms: {
    [expr: string]: (expr: string) => Record<string, any>;
  };
  filters: {
    [expr: string]: (items: T[], expr: string) => T[];
  };
  sorter: (sortBy?: string, desc?: boolean) => (a: T, b: T) => number;
  sortBy?: ISortOptions;
}

export interface IQParserResult<T> {
  noParse: Set<string>;
  fields: Set<keyof T>;
  sortBy?: ISortOptions;
  cond: Record<string, any>;
}

export default class QParser<T extends Record<string ,any>> {
  public options: IQParserOptions<T> = {
    dialect: "mongo",
    id: "_id",
    transforms: {},
    filters: {},
    sorter: anySorter,
  };

  private sets = {
    anyOf: new Set<string>(),
    isString: new Set<string>(),
    isDate: new Set<string>(["created", "modified", "createdAt", "updatedAt", "date"]),
    noParse: new Set<string>()
  }

  public result: IQParserResult<T> = {
    noParse: new Set<string>(),
    fields: new Set<string>(),
    cond: {}
  };

  constructor(public q: string | Record<string, any>, options: Partial<IQParserOptions<T>> = {}) {
    for (const [k, v] of Object.entries(options)) {
      if (v && typeof v === "object") {
        (this.options as any)[k] = (this.options as any)[k] || {};
        Object.assign((this.options as any)[k], v);
      } else if (Array.isArray(v)) {
        for (const v0 of v) {
          (this as any)[k].add(v0);
        }
      } else {
        (this.options as any)[k] = v;
      }
    }

    Object.keys(this.options.filters).forEach((fk) => this.sets.noParse.add(fk));

    this.result.cond = this._getCond(this.q);
  }

  public filter(item: T): boolean {
    return this.condFilter(this.result.cond)(item);
  }

  public parse(items: T[]): T[] {
    const {key, desc} = this.result.sortBy || this.options.sortBy || {} as any;
    if (key) {
      items = items.sort(this.options.sorter(key, desc))
    }

    items = items.filter((it) => this.filter(it));

    for (const np of this.result.noParse) {
      const filterFn = this.options.filters[np];
      if (filterFn) {
        items = filterFn(items, np);
      }
    }

    return items;
  }

  private _getCond(q: string | Record<string, any>): Record<string, any> {
    if (typeof q === "object") {
      return q;
    }

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
        this.result.sortBy = {
          desc: true,
          key: q.substr(sb.length)
        };
        return {};
      }

      return { $nor: [this._getCond(q.substr(1))] };
    }

    throw new Error("Not negative");
  }

  private parseFullExpr(q: string) {
    const m = /^([\w-]+)(:|~|[><]=?|=)([\S-]+|"[^"]+")$/.exec(q);
    if (m) {
      let [m0, k, op, v]: any[] = m;

      const transformFn = this.options.transforms[m0];
      if (transformFn) {
        return transformFn(m0);
      }

      if (this.sets.noParse.has(m0)) {
        this.result.noParse.add(m0);
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
        this.result.sortBy = {
          key: v.toString(),
          desc: false
        };
        return {};
      }

      if (v === "NULL") {
        if (this.options.dialect === "mongo") {
          this.result.fields.add(k);
          return { $or: [
            { [k]: null },
            { [k]: "" },
            { [k]: {$exists: false} }
          ] };
        } else {
          this.result.fields.add(k);
          return { [k]: { $exists: false } };
        }
      }

      if (this.sets.isDate.has(k)) {
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
            v = toDate(v) || v;
          }
        }
      }

      if (op === ":") {
        if (typeof v === "string" || this.sets.isString.has(k)) {
          if (k !== this.options.id) {
            v = { $regex: escapeRegExp(v.toString()) };
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

      this.result.fields.add(k);
      return { [k]: v };
    }

    throw new Error("Not full expression");
  }


  private parsePartialExpr(q: string) {
    if (q && q.indexOf(":") === -1) {
      const orCond: any[] = [];

      if (this.options.anyOf) {
        for (const a of this.options.anyOf) {
          if (this.sets.isString.has(a)) {
            this.result.fields.add(a);
            orCond.push({ [a]: { $regex: escapeRegExp(q) } });
          } else {
            this.result.fields.add(a);
            orCond.push({ [a]: q });
          }
        }
      } else {
        this.result.fields.add("*");
        return {"*": { $regex: escapeRegExp(q) }};
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
          } else if (k === "$nor") {
            return !v.some((x: Record<string, any>) => this.condFilter(x)(item));
          }
        } else {
          let itemK = dotGetter(item, k);

          if (this.sets.isDate.has(k)) {
            itemK = toDate(itemK);
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
                  } else if (op === "$exists") {
                    return (itemK === null || itemK === undefined || itemK === "") !== v[op];
                  } else {
                    const v1 = itemK;
                    const v2 = v[op];

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
      } catch (e) {
        v = undefined;
        break;
      }
    }
  }

  if (v && v.constructor === {}.constructor && Object.keys(v).length === 0) {
    v = undefined;
  }

  return v;
}

export function anySorter<T extends Record<string, any>>(sortBy?: keyof T, desc?: boolean) {
  return (a: T, b: T): number => {
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