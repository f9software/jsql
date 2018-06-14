"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
class Parser {
    parse(jsql) {
        this.buffer = [];
        this.values = [];
        if (jsql.hasOwnProperty('select')) {
            this.parseSelect(jsql);
        }
        else if (jsql.hasOwnProperty('insert')) {
            this.parseInsert(jsql);
        }
        else if (jsql.hasOwnProperty('update')) {
            this.parseUpdate(jsql);
        }
        else if (jsql.hasOwnProperty('deleteFrom')) {
            this.parseDelete(jsql);
        }
        const out = {
            sql: this.buffer.join(''),
            values: this.values
        };
        this.buffer = [];
        this.values = [];
        return out;
    }
    /** Type checkers **/
    isSelect(jsql) {
        return _.isPlainObject(jsql) && jsql.hasOwnProperty('select');
    }
    isSql(jsql) {
        return _.isPlainObject(jsql) && jsql.hasOwnProperty('sql');
    }
    /** Parsers **/
    parseSelect(jsql) {
        const buf = this.buffer;
        buf.push(' SELECT ');
        jsql.select.map((column, index) => {
            if (index > 0) {
                buf.push(', ');
            }
            if (typeof column === 'string' && column === '*') {
                buf.push('*');
            }
            else {
                this.parseColumn(column);
            }
        });
        buf.push(' FROM ');
        this.parseTable(jsql.from);
        if (jsql.where) {
            buf.push(' WHERE ');
            jsql.where.forEach(where => this.parseWhere(where));
        }
        if (jsql.order) {
            buf.push(' ORDER BY ');
            jsql.order.forEach((order, index) => {
                if (index > 0) {
                    buf.push(', ');
                }
                this.parseOrder(order);
            });
        }
        if (jsql.limit) {
            buf.push(' LIMIT ');
            this.parseLimit(jsql.limit);
        }
    }
    parseInsert(jsql) {
        const buf = this.buffer;
        const columns = Object.keys(jsql.insert);
        buf.push(' INSERT INTO ');
        this.parseTable(jsql.into);
        buf.push(' (`', columns.join('`, `'), '`) VALUES (');
        columns.forEach((column, index) => {
            if (index > 0) {
                buf.push(', ');
            }
            this.parseValue(jsql.insert[column]);
        });
        buf.push(')');
    }
    parseUpdate(jsql) {
        const buf = this.buffer;
        const columns = Object.keys(jsql.update);
        buf.push(' UPDATE ');
        this.parseTable(jsql.into);
        buf.push(' SET ');
        columns.forEach((column, index) => {
            if (index > 0) {
                buf.push(', ');
            }
            buf.push('`', column, '` = ');
            this.parseValue(jsql.update[column]);
        });
        buf.push(' WHERE ');
        jsql.where.forEach(where => this.parseWhere(where));
    }
    parseDelete(jsql) {
        const buf = this.buffer;
        buf.push(' DELETE FROM ');
        this.parseTable(jsql.deleteFrom);
        buf.push(' WHERE ');
        jsql.where.forEach(where => this.parseWhere(where));
    }
    /** Parser helpers **/
    parseWhere(where) {
        const buf = this.buffer;
        if (typeof where === 'string') {
            buf.push(' ', where);
        }
        // parse WhereShort
        else if (_.isPlainObject(where)) {
            buf.push('(');
            Object.keys(where)
                .forEach((column, index) => {
                if (index > 0) {
                    buf.push(' AND ');
                }
                buf.push('`', column, '`');
                const value = where[column];
                const type = typeof value;
                if (type === 'string' || type === 'number') {
                    buf.push(' = ');
                    this.parseValue(value);
                }
                // WhereValue[]
                else if (_.isArray(value)) {
                    buf.push(' IN (');
                    value.map((v, index) => {
                        if (index > 0) {
                            buf.push(', ');
                        }
                        this.parseValue(v);
                    });
                    buf.push(')');
                }
                else if (this.isSelect(value)) {
                    buf.push(' IN (');
                    this.parseSelect(value);
                    buf.push(')');
                }
                else if (this.isSql(value)) {
                    buf.push(' = (');
                    this.parseSql(value);
                    buf.push(')');
                }
                // WhereValueWithOperator
                else if (_.isPlainObject(value)) {
                    this.parseWhereValueOperator(value);
                }
            });
            buf.push(')');
        }
    }
    parseWhereValueOperator(whereValueOperator) {
        const operator = Object.keys(whereValueOperator)[0];
        const value = whereValueOperator[operator];
        const buf = this.buffer;
        buf.push(' '); // for better looking
        if (operator === 'BETWEEN') {
            buf.push(operator, ' ');
            this.parseValue(value[0]);
            buf.push(' AND ');
            this.parseValue(value[1]);
        }
        else if (operator === 'IN' || (operator === '=' && _.isArray(value))) {
            buf.push('IN (');
            value.forEach((v, index) => {
                if (index > 0) {
                    buf.push(', ');
                }
                this.parseValue(v);
            });
            buf.push(')');
        }
        else {
            buf.push(operator, ' ');
            this.parseValue(value);
        }
    }
    parseValue(value) {
        const type = typeof value;
        const buf = this.buffer;
        if (type === 'boolean') {
            buf.push(value ? '1' : '0');
        }
        else if (type === 'string' || type === 'number') {
            buf.push('?');
            this.values.push(value);
        }
        else if (type === 'object' && value instanceof Date) {
            buf.push('FROM_UNIXTIME(?)');
            this.values.push(value.getTime() / 1000);
        }
        else if (this.isSelect(value)) {
            buf.push('(');
            this.parseSelect(value);
            buf.push(')');
        }
        else if (this.isSql(value)) {
            buf.push('(');
            this.parseSql(value);
            buf.push(')');
        }
        else if (value === null || value === undefined) {
            buf.push('null');
        }
    }
    parseSql(sql) {
        this.buffer.push(sql.sql);
        Array.prototype.push.apply(this.values, sql.values);
    }
    parseOrder(order) {
        this.buffer.push(order.column, ' ', order.direction);
    }
    parseLimit(limit) {
        this.buffer.push(limit.join(', '));
    }
    parseColumn(column) {
        if (typeof column === 'string') {
            this.buffer.push('`', column, '`');
        }
        else if (_.isPlainObject(column)) {
            Object.keys(column)
                .map(alias => {
                this.buffer.push('(');
                if (this.isSelect(column[alias])) {
                    this.parseSelect(column[alias]);
                }
                else {
                    this.buffer.push(column[alias]);
                }
                this.buffer.push(') AS ', alias);
            });
        }
    }
    parseTable(table) {
        const buf = this.buffer;
        if (typeof table === 'string') {
            buf.push('`', table, '`');
        }
        else if (_.isPlainObject(table)) {
            Object.keys(table)
                .forEach((alias, index) => {
                if (index > 0) {
                    buf.push(', ');
                }
                const type = typeof table[alias];
                if (type === 'string') {
                    buf.push('`', table[alias], '`');
                }
                else if (this.isSelect(table[alias])) {
                    buf.push('(');
                    this.parseSelect(table[alias]);
                    buf.push(')');
                }
                this.buffer.push(' AS ', alias);
            });
        }
    }
}
exports.Parser = Parser;
function parse(jsql) {
    return (new Parser()).parse(jsql);
}
exports.parse = parse;
