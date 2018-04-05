# jsql
A small utility to convert JSON objects to SQL strings.

## Select
```
const select: Select = {
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
        }
    ],
    from: {
        a: 'users',
        b: {
            select: ['firstName', 'lastName'],
            from: 'names'
        }
    },
    where: [{
        email: 'iulian@f9software.com'
    }, 'OR', 'COUNT(name) > 1']
};

console.log(parse(select));
```

Result when parsing a select jsql
```
{
    "sql": " SELECT `name`, `username`, `email`, `password`, ( SELECT `id` FROM `ids` WHERE `email` = (a.email) LIMIT 0, 1) AS randomId FROM `users` AS a, ( SELECT `firstName`, `lastName` FROM `names`) AS b WHERE `email` = ? OR COUNT(name) > 1",
    "values": ["iulian@f9software.com"]
}
```

## Insert
```
const insert: Insert = {
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
```

Result when parsing a insert jsql
```
{
    "sql": " INSERT INTO `users` (`name`, `email`, `username`) VALUES (?, ?, ( SELECT `username` FROM `usernames` WHERE `available` = 1 ORDER BY index ASC LIMIT 0, 1))",
    "values": ["John", "john@example.com" ]
}
```

## Update
```
const update: Update = {
    update: {
        name: 'John',
        email: 'john@example.com'
    },
    into: 'users',
    where: [{
        id: '1234'
    }]
};
```

Result when parsing a update jsql
```
{
    "sql": " UPDATE `users` SET `name` = ?, `email` = ? WHERE `id` = ?",
    "values": [ "John", "john@example.com", "1234"]
}
```

## Delete
```
const delete: Delete = {
    deleteFrom: 'users',
    where: [{
        id: '1234'
    }]
};
```

Result when parsing a delete jsql
```
{
    "sql": " DELETE FROM `users` WHERE `id` = ?",
    "values": ["1234"]
}
```
