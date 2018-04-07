import * as _ from 'lodash';

export interface ColumnAlias {
    [key: string]: Select | string;
}

export type Column = string | ColumnAlias;

export interface TableAlias {
    [key: string]: string | Select;
}

export type Table = string | TableAlias;

export interface Sql {
    sql: string;
    values?: (string | number)[]
}

// export interface WhereValueDetailed {
//     operator: string;
//     value: string | Select;
// }

export interface WhereValueWithOperator {
    [key: string]: WhereValue | WhereValue[];
}

export type WhereValue = string | number | boolean | Select | /*WhereValueDetailed |*/ Sql;

export interface WhereShort {
    [key: string]: WhereValue | WhereValue[] | WhereValueWithOperator;
}

export type Where = string | WhereShort;

export type Limit = number[];

export interface Order {
    column: string;
    direction: 'ASC' | 'DESC'
}

export interface Select {
    select: Column[];
    from: Table;
    where?: Where[];
    limit?: Limit;
    order?: Order[]
}


export type Value = string | number | boolean | Select | Sql;

export interface ValueSet {
    [key: string]: Value;
}

export interface Insert {
    insert: ValueSet;
    into: Table;
}

export interface Update {
    update: ValueSet;
    into: Table;
    where: Where[]
}

export interface Delete {
    deleteFrom: Table;
    where: Where[];
}


export interface Result {
    sql: string;
    values: (string | number | boolean)[]
}

export type JSql = Select | Insert | Update | Delete;


export class Parser {
    private buffer: string[];

    private values: (string | number | boolean)[];

    parse(jsql: JSql): Result {
        this.buffer = [];
        this.values = [];

        if (jsql.hasOwnProperty('select')) {
            this.parseSelect(<Select> jsql);
        }
        else if (jsql.hasOwnProperty('insert')) {
            this.parseInsert(<Insert> jsql);
        }
        else if (jsql.hasOwnProperty('update')) {
            this.parseUpdate(<Update> jsql);
        }
        else if (jsql.hasOwnProperty('deleteFrom')) {
            this.parseDelete(<Delete> jsql);
        }

        const out: Result = {
            sql: this.buffer.join(''),
            values: this.values
        };

        this.buffer = this.values = null;

        return out;
    }



    /** Type checkers **/

    private isSelect(jsql: any): boolean {
        return _.isPlainObject(jsql) && jsql.hasOwnProperty('select');
    }

    private isSql(jsql: any): boolean {
        return _.isPlainObject(jsql) && jsql.hasOwnProperty('sql');
    }



    /** Parsers **/

    private parseSelect(jsql: Select) {
        const buf = this.buffer;

        buf.push(' SELECT ');

        jsql.select.map(
            (column, index: number) => {
                if (index > 0) {
                    buf.push(', ');
                }
                if (typeof column === 'string' && column === '*') {
                    buf.push('*');
                }
                else {
                    this.parseColumn(column);
                }
            }
        );

        buf.push(' FROM ');
        this.parseTable(jsql.from);

        if (jsql.where) {
            buf.push(' WHERE ');
            jsql.where.forEach(where => this.parseWhere(where));
        }

        if (jsql.order) {
            buf.push(' ORDER BY ');
            jsql.order.forEach((order: Order, index: number) => {
                if (index > 0) {
                    buf.push(', ');
                }
                this.parseOrder(order);
            })
        }

        if (jsql.limit) {
            buf.push(' LIMIT ');
            this.parseLimit(jsql.limit);
        }
    }

    private parseInsert(jsql: Insert) {
        const buf = this.buffer;
        const columns = Object.keys(jsql.insert);

        buf.push(' INSERT INTO ');
        this.parseTable(jsql.into);
        buf.push(' (`', columns.join('`, `'), '`) VALUES (');

        columns.forEach(
            (column, index: number) => {
                if (index > 0) {
                    buf.push(', ');
                }
                this.parseValue(jsql.insert[column]);
            }
        );
        buf.push(')');
    }

    private parseUpdate(jsql: Update) {
        const buf = this.buffer;
        const columns = Object.keys(jsql.update);

        buf.push(' UPDATE ');
        this.parseTable(jsql.into);
        buf.push(' SET ');

        columns.forEach(
            (column, index: number) => {
                if (index > 0) {
                    buf.push(', ');
                }
                buf.push('`', column, '` = ');
                this.parseValue(jsql.update[column]);
            }
        );

        buf.push(' WHERE ');
        jsql.where.forEach(where => this.parseWhere(where));
    }

    private parseDelete(jsql: Delete) {
        const buf = this.buffer;

        buf.push(' DELETE FROM ');
        this.parseTable(jsql.deleteFrom);

        buf.push(' WHERE ');
        jsql.where.forEach(where => this.parseWhere(where));
    }



    /** Parser helpers **/

    private parseWhere(where: Where) {
        const buf = this.buffer;

        if (typeof where === 'string') {
            buf.push(' ', where);
        }
        // parse WhereSHort
        else if (_.isPlainObject(where)) {
            buf.push('(');
            Object.keys(where)
                .forEach((column, index: number) => {
                    if (index > 0) {
                        buf.push(' AND ');
                    }

                    buf.push('`', column, '`');

                    const value = where[column];
                    const type = typeof value;
                    if (type === 'string' || type === 'number') {
                        buf.push(' = ');
                        this.parseValue(<string | number > value);
                    }
                    // WhereValueWithOperator
                    else if (_.isPlainObject(value) && value.hasOwnProperty('operator')) {
                        this.parseWhereValueOperator(<WhereValueWithOperator> value);
                    }
                    else if (_.isArray(value)) {
                        buf.push(' IN (');
                        (<WhereValue[]> value).map((v, index: number) => {
                            if (index > 0) {
                                buf.push(', ');
                            }
                            this.parseValue(v);
                        });
                        buf.push(')');
                    }
                });
            buf.push(')');
        }
    }

    private parseWhereValueOperator(whereValueOperator: WhereValueWithOperator) {
        const operator = Object.keys(whereValueOperator)[0];
        const value = whereValueOperator[operator];
        const buf = this.buffer;

        buf.push(operator);

        if (operator === 'BETWEEN') {
            this.parseValue((<WhereValue[]> value)[0]);
            buf.push(' AND');
            this.parseValue((<WhereValue[]> value)[1]);
        }
        else {
            this.parseValue(<WhereValue> value);
        }
    }

    private parseValue(value: string | number | boolean | Select | /*WhereValueDetailed |*/ Sql) {
        const type = typeof value;
        const buf = this.buffer;

        if (type === 'boolean') {
            buf.push(value ? '1' : '0');
        }
        else if (type === 'string' || type === 'number') {
            buf.push('?');
            this.values.push(<string | number> value);
        }
        else if (this.isSelect(value)) {
            buf.push('(');
            this.parseSelect(<Select> value);
            buf.push(')');
        }
        else if (this.isSql(<string> value)) {
            buf.push('(');
            this.parseSql(<Sql> value);
            buf.push(')');
        }
        else if (value === null) {
            buf.push('null');
        }
    }

    private parseSql(sql: Sql) {
        this.buffer.push(sql.sql);
        Array.prototype.push.apply(this.values, sql.values);
    }

    private parseOrder(order: Order) {
        this.buffer.push(order.column, ' ', order.direction);
    }

    private parseLimit(limit: Limit) {
        this.buffer.push(limit.join(', '));
    }

    private parseColumn(column: Column) {
        if (typeof column === 'string') {
            this.buffer.push('`', column, '`');
        }
        else if (_.isPlainObject(column)) {
            Object.keys(column)
                .map(
                    alias => {
                        this.buffer.push('(');
                        if (this.isSelect(column[alias])) {
                            this.parseSelect(<Select> column[alias]);
                        }
                        else {
                            this.buffer.push(<string> column[alias]);
                        }
                        this.buffer.push(') AS ', alias);
                    }
                )
        }
    }

    private parseTable(table: Table) {
        const buf = this.buffer;

        if (typeof table === 'string') {
            buf.push('`', table, '`');
        }
        else if (_.isPlainObject(table)) {
            Object.keys(table)
                .forEach(
                    (alias, index: number) => {
                        if (index > 0) {
                            buf.push(', ');
                        }

                        const type = typeof table[alias];
                        if (type === 'string') {
                            buf.push('`', <string> table[alias], '`');
                        }
                        else if (this.isSelect(table[alias])) {
                            buf.push('(');
                            this.parseSelect(<Select> table[alias]);
                            buf.push(')');
                        }
                        this.buffer.push(' AS ', alias);
                    }
                )
        }
    }
}


export function parse(jsql: JSql): Result {
    return (new Parser()).parse(jsql);
}
