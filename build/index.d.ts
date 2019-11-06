export interface ISortOptions {
    key: string;
    desc: boolean;
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
export default class QParser<T extends Record<string, any>> {
    q: string | Record<string, any>;
    options: IQParserOptions<T>;
    private sets;
    result: IQParserResult<T>;
    constructor(q: string | Record<string, any>, options?: Partial<IQParserOptions<T>>);
    filter(item: T): boolean;
    parse(items: T[]): T[];
    private _getCond;
    private removeBrackets;
    private parseSep;
    private parseNeg;
    private parseFullExpr;
    private parsePartialExpr;
    private condFilter;
}
export declare function dotGetter(d: any, k: string): any;
export declare function anySorter<T extends Record<string, any>>(sortBy?: keyof T, desc?: boolean): (a: T, b: T) => number;
export declare function escapeRegExp(s: string): string;
//# sourceMappingURL=index.d.ts.map