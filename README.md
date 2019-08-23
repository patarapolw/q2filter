# q2filter

Advanced query string parser for MongoDB and `Array.prototype.filter`

## Usage

```typescript
import QParser from "q2filter";
const p = new QParser(parserOptions);
const cond = p.getCond(q);  // cond for MongoDB find and aggregate
const filteredArray = p.filter(allItems, q);  // Filtering list of items
```

Example parserOptions. All options can be omitted.

```typescript
{
  dialect: "filter",  // or 'mongo'
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
  },
  sortBy: "date",
  desc: true
}
```

Acceptable `q`'s and their output can be seen at [/tests/examples.yaml](/tests/examples.yaml)

## Installation

```
npm i q2filter
```
