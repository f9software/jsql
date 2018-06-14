import {Delete, Insert, Parser, Select, Update} from "./index";


const sel1: Select = {
    select: [
        'name', 'username', 'email', 'password',
        {
            randomId: {
                select: ['id'],
                from: 'ids',
                where: [{
                    email: {sql: 'a.email'}
                }],
                limit: [0, 1]
            }
            // randomId: 'as'
        }
    ],
    // from: 'users',
    from: {
        a: 'users',
        b: {
            select: ['firstName', 'lastName'],
            from: 'names'
        }
    },
    where: [{
        id: {'=': ['value1', 'value2']},
        something: {'>': 10},
        iam: {'=': 'test'}
    }, 'AND', {
        // 'name': {
        //     operator: 'LIKE',
        //     value: 'Ilea'
        // },
        email: 'john@example.com',
        ids: [1, 2, 3],
        name: ['iulian', {select: ['*'], from: 'tableName'}]
    }, 'OR', 'COUNT(name) > 1']
};


const insert1: Insert = {
    insert: {
        name: 'John',
        email: 'john@example.com',
        username: {
            select: ['username'],
            from: 'usernames',
            where: [{
                available: true
            }],
            order: [{
                column: 'index',
                direction: 'ASC'
            }],
            limit: [0, 1]
        }
    },
    into: 'users'
};


const update1: Update = {
    update: {
        name: 'John',
        email: 'john@example.com'
    },
    into: 'users',
    where: [{
        id: '1234'
    }]
};


const delete1: Delete = {
    deleteFrom: 'users',
    where: [{
        id: '1234'
    }]
};

const parser = new Parser();
console.log(parser.parse(sel1));
console.log(parser.parse(update1));
console.log(parser.parse(insert1));
console.log(parser.parse(delete1));
