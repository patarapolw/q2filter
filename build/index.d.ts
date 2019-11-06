export interface ISortOptions {
    key: string;
    desc: boolean;
}
export interface IQParserOptions<T> {
    /**
     * @default "mongo"
     */
    dialect: "mongo" | "extended";
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
}
export default class QParser<T extends Record<string, any>> {
    q: string;
    options: IQParserOptions<T>;
    anyOf: Set<string>;
    isString: Set<string>;
    isDate: Set<string>;
    noParse: Set<string>;
    result: IQParserResult<T>;
    constructor(q: string, options?: Partial<IQParserOptions<T>>);
    parse(items: T[]): T[];
    getCondFull(): IQParserResult<T> & {
        cond: Record<string, any>;
    };
    getCond(): Record<string, any>;
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