"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var v4_1 = __importDefault(require("uuid/v4"));
var moment_1 = __importDefault(require("moment"));
var valid_moment_1 = require("valid-moment");
moment_1.default.suppressDeprecationWarnings = true;
var QParser = /** @class */ (function () {
    function QParser(q, options) {
        var e_1, _a, e_2, _b;
        var _this = this;
        if (options === void 0) { options = {}; }
        this.q = q;
        this.options = {
            dialect: "mongo",
            id: "_id",
            transforms: {},
            filters: {},
            sorter: anySorter,
        };
        this.anyOf = new Set();
        this.isString = new Set();
        this.isDate = new Set(["created", "modified", "createdAt", "updatedAt", "date"]);
        this.noParse = new Set();
        this.result = {
            noParse: new Set(),
            fields: new Set()
        };
        try {
            for (var _c = __values(Object.entries(options)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = __read(_d.value, 2), k = _e[0], v = _e[1];
                if (v && typeof v === "object") {
                    Object.assign(this.options[k], v);
                }
                else if (Array.isArray(v)) {
                    try {
                        for (var v_1 = (e_2 = void 0, __values(v)), v_1_1 = v_1.next(); !v_1_1.done; v_1_1 = v_1.next()) {
                            var v0 = v_1_1.value;
                            this[k].add(v0);
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (v_1_1 && !v_1_1.done && (_b = v_1.return)) _b.call(v_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
                else {
                    this.options[k] = v;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        Object.keys(this.options.filters).forEach(function (fk) { return _this.noParse.add(fk); });
    }
    QParser.prototype.parse = function (items) {
        var e_3, _a;
        var cond = this.getCond();
        var _b = this.result.sortBy || this.options.sortBy || {}, key = _b.key, desc = _b.desc;
        if (key) {
            items = items.sort(this.options.sorter(key, desc));
        }
        items = items.filter(this.condFilter(cond));
        try {
            for (var _c = __values(this.result.noParse), _d = _c.next(); !_d.done; _d = _c.next()) {
                var np = _d.value;
                var filterFn = this.options.filters[np];
                if (filterFn) {
                    items = filterFn(items, np);
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return items;
    };
    QParser.prototype.getCondFull = function () {
        return __assign({ cond: this.getCond() }, this.result);
    };
    QParser.prototype.getCond = function () {
        return this._getCond(this.q);
    };
    QParser.prototype._getCond = function (q) {
        var e_4, _a;
        q = q.trim();
        try {
            for (var _b = __values([
                this.removeBrackets,
                this.parseSep(" OR "),
                this.parseSep(" "),
                this.parseNeg,
                this.parseFullExpr,
                this.parsePartialExpr
            ]), _c = _b.next(); !_c.done; _c = _b.next()) {
                var method = _c.value;
                try {
                    return method.bind(this)(q);
                }
                catch (e) { }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return {};
    };
    QParser.prototype.removeBrackets = function (q) {
        if (q[0] === "(" && q[q.length - 1] === ")") {
            return this._getCond(q.substr(1, q.length - 2));
        }
        throw new Error("Not bracketed");
    };
    QParser.prototype.parseSep = function (sep) {
        var _this = this;
        return function (q) {
            var _a;
            var brackets = {};
            q = q.replace(/\([^)]+\)/g, function (p0) {
                var id = v4_1.default();
                brackets[id] = p0;
                return id;
            });
            var tokens = q.split(sep);
            tokens.forEach(function (t, i) {
                var e_5, _a;
                try {
                    for (var _b = __values(Object.keys(brackets)), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var k = _c.value;
                        tokens[i] = tokens[i].replace(k, brackets[k]);
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
            });
            if (tokens.length >= 2) {
                var parsedTokens = tokens.map(function (t) { return _this._getCond(t); }).filter(function (t) { return t && Object.keys(t).length > 0; });
                if (parsedTokens.length > 1) {
                    return _a = {}, _a[sep === " OR " ? "$or" : "$and"] = parsedTokens, _a;
                }
                else {
                    return parsedTokens[0] || {};
                }
            }
            throw new Error("Not separated by '" + sep + "'");
        };
    };
    QParser.prototype.parseNeg = function (q) {
        if (q[0] === "-") {
            var sb = "-sortBy:";
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
    };
    QParser.prototype.parseFullExpr = function (q) {
        var _a, _b, _c, _d, _e;
        var m = /^([\w-]+)(:|~|[><]=?|=)([\S-]+|"[^"]+")$/.exec(q);
        if (m) {
            var _f = __read(m, 4), m0 = _f[0], k = _f[1], op = _f[2], v = _f[3];
            var transformFn = this.options.transforms[m0];
            if (transformFn) {
                return transformFn(m0);
            }
            if (this.noParse.has(m0)) {
                this.result.noParse.add(m0);
                return {};
            }
            if (v.length > 2 && v[0] === '"' && v[v.length - 1] === '"') {
                v = v.substr(1, v.length - 2);
            }
            else {
                var m1 = /^\d+(?:\.\d+)?$/.exec(v);
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
                            (_a = {}, _a[k] = null, _a),
                            (_b = {}, _b[k] = "", _b),
                            (_c = {}, _c[k] = { $exists: false }, _c)
                        ] };
                }
                else {
                    this.result.fields.add(k);
                    return _d = {}, _d[k] = { $exists: false }, _d;
                }
            }
            if (this.isDate.has(k)) {
                if (v === "NOW") {
                    v = new Date();
                }
                else if (typeof v === "string") {
                    var m1 = /^([-+]\d+)(\S+)$/.exec(v);
                    var isMomentParsed = false;
                    if (m1) {
                        try {
                            v = moment_1.default().add(parseInt(m1[1]), m1[2]).toDate();
                            isMomentParsed = true;
                        }
                        catch (e) { }
                    }
                    if (!isMomentParsed) {
                        v = valid_moment_1.toDate(v) || v;
                    }
                }
            }
            if (op === ":") {
                if (typeof v === "string" || this.isString.has(k)) {
                    if (k !== this.options.id) {
                        v = { $regex: escapeRegExp(v.toString()) };
                    }
                }
            }
            else if (op === "~") {
                v = { $regex: v.toString() };
            }
            else if (op === ">=") {
                v = { $gte: v };
            }
            else if (op === ">") {
                v = { $gt: v };
            }
            else if (op === "<=") {
                v = { $lte: v };
            }
            else if (op === "<") {
                v = { $lt: v };
            }
            this.result.fields.add(k);
            return _e = {}, _e[k] = v, _e;
        }
        throw new Error("Not full expression");
    };
    QParser.prototype.parsePartialExpr = function (q) {
        var e_6, _a, _b, _c;
        if (q && q.indexOf(":") === -1) {
            var orCond = [];
            if (this.options.anyOf) {
                try {
                    for (var _d = __values(this.options.anyOf), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var a = _e.value;
                        if (this.isString.has(a)) {
                            this.result.fields.add(a);
                            orCond.push((_b = {}, _b[a] = { $regex: escapeRegExp(q) }, _b));
                        }
                        else {
                            this.result.fields.add(a);
                            orCond.push((_c = {}, _c[a] = q, _c));
                        }
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                    }
                    finally { if (e_6) throw e_6.error; }
                }
            }
            else {
                this.result.fields.add("*");
                return { "*": { $regex: escapeRegExp(q) } };
            }
            if (orCond.length > 1) {
                return { $or: orCond };
            }
            else if (orCond.length === 1) {
                return orCond[0];
            }
            return {};
        }
        throw new Error("Not partial expression");
    };
    QParser.prototype.condFilter = function (cond) {
        var _this = this;
        return function (item) {
            var e_7, _a;
            var _loop_1 = function (k, v) {
                if (k[0] === "$") {
                    if (k === "$and") {
                        return { value: v.every(function (x) { return _this.condFilter(x)(item); }) };
                    }
                    else if (k === "$or") {
                        return { value: v.some(function (x) { return _this.condFilter(x)(item); }) };
                    }
                    else if (k === "$nor") {
                        return { value: !v.some(function (x) { return _this.condFilter(x)(item); }) };
                    }
                }
                else {
                    var itemK_1 = dotGetter(item, k);
                    if (_this.isDate.has(k)) {
                        itemK_1 = valid_moment_1.toDate(itemK_1);
                    }
                    if (v && v.constructor === {}.constructor
                        && Object.keys(v).some(function (k0) { return k0[0] === "$"; })) {
                        return { value: (function () {
                                var e_8, _a;
                                var _loop_2 = function (op) {
                                    try {
                                        if (op === "$regex") {
                                            if (Array.isArray(itemK_1)) {
                                                var r_1 = new RegExp(v[op].toString(), "i");
                                                return { value: itemK_1.some(function (el) { return r_1.test(el); }) };
                                            }
                                            else {
                                                return { value: new RegExp(v[op].toString(), "i").test(itemK_1) };
                                            }
                                        }
                                        else if (op === "$exists") {
                                            return { value: (itemK_1 === null || itemK_1 === undefined || itemK_1 === "") !== v[op] };
                                        }
                                        else {
                                            var v1 = itemK_1;
                                            var v2 = v[op];
                                            var canCompare = false;
                                            if (typeof v1 === "object" && typeof v2 === "object") {
                                                if (v1.constructor === v2.constructor) {
                                                    canCompare = true;
                                                }
                                            }
                                            else {
                                                canCompare = (typeof v1 === typeof v2);
                                            }
                                            if (canCompare) {
                                                if (op === "$gte") {
                                                    return { value: v1 >= v2 };
                                                }
                                                else if (op === "$gt") {
                                                    return { value: v1 > v2 };
                                                }
                                                else if (op === "$lte") {
                                                    return { value: v1 <= v2 };
                                                }
                                                else if (op === "$lt") {
                                                    return { value: v1 < v2 };
                                                }
                                            }
                                        }
                                    }
                                    catch (e) { }
                                };
                                try {
                                    for (var _b = (e_8 = void 0, __values(Object.keys(v))), _c = _b.next(); !_c.done; _c = _b.next()) {
                                        var op = _c.value;
                                        var state_2 = _loop_2(op);
                                        if (typeof state_2 === "object")
                                            return state_2.value;
                                    }
                                }
                                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                                finally {
                                    try {
                                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                                    }
                                    finally { if (e_8) throw e_8.error; }
                                }
                                return false;
                            })() };
                    }
                    else if (Array.isArray(itemK_1)) {
                        if (!itemK_1.includes(v)) {
                            return { value: false };
                        }
                    }
                    else if (itemK_1 !== v) {
                        return { value: false };
                    }
                }
            };
            try {
                for (var _b = __values(Object.entries(cond)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = __read(_c.value, 2), k = _d[0], v = _d[1];
                    var state_1 = _loop_1(k, v);
                    if (typeof state_1 === "object")
                        return state_1.value;
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_7) throw e_7.error; }
            }
            return true;
        };
    };
    return QParser;
}());
exports.default = QParser;
function dotGetter(d, k) {
    var e_9, _a;
    var v = d;
    try {
        for (var _b = __values(k.split(".")), _c = _b.next(); !_c.done; _c = _b.next()) {
            var kn = _c.value;
            if (v && v.constructor === {}.constructor) {
                if (kn === "*") {
                    v = Object.values(v);
                }
                else {
                    v = v[kn];
                    if (v === undefined) {
                        v = {};
                    }
                }
            }
            else if (Array.isArray(v)) {
                try {
                    v = v[parseInt(kn)];
                }
                catch (e) {
                    v = undefined;
                    break;
                }
            }
        }
    }
    catch (e_9_1) { e_9 = { error: e_9_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_9) throw e_9.error; }
    }
    if (v && v.constructor === {}.constructor && Object.keys(v).length === 0) {
        v = undefined;
    }
    return v;
}
exports.dotGetter = dotGetter;
function anySorter(sortBy, desc) {
    return function (a, b) {
        if (!sortBy) {
            return 0;
        }
        var m = a[sortBy];
        var n = b[sortBy];
        if (typeof m === typeof n) {
            if (typeof m === "string") {
                return desc ? n.localeCompare(m) : m.localeCompare(n);
            }
            else if (typeof m === "number") {
                return desc ? n - m : m - n;
            }
            else {
                return 0;
            }
        }
        else {
            var typeDict = {
                "number": 1,
                "string": 2,
                "object": 3
            };
            var tM = typeDict[typeof m] || -1;
            var tN = typeDict[typeof n] || -1;
            return desc ? tN - tM : tM - tN;
        }
    };
}
exports.anySorter = anySorter;
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
exports.escapeRegExp = escapeRegExp;
