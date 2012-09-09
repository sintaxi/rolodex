# rolodex

## Instalation

I always recomend you bundle your dependencies with your application. To do
this, create a `package.json` file in the root of your project with the
minimum information...

    {
      "name": "yourapplication",
      "version": "0.1.0",
      "dependencies": {
        "rolodex": "0.6.4"
      }
    }

Then run the following command using npm...

    npm install

OR, if you just want to start playing with the library run...

    npm install rolodex

## Docs

To create a rolodex object that gives us user management functions we must
first pass in a redis client for it to use. require the library `redis` and
then pass it as an argument to the `rolodex` lib. 

    var redis   = require("redis")
    var client  = redis.createClient()
    var rolodex = require("rolodex")(client)

Now we have rolodex.account object that gives us account management functions.

### Errors

Anytime errors are accepted as the first argument of the callback it will
return `null` if the request was successful and if there are validation
errors it will look like the following...

    {
      messages: [
        "Username must be unique"
      ],
      details: {
        "account": "is not in the system"
      }
    }

### Account

Account Object looks like the following...

    { 
      id: 'ojzg-su2w-kqsn',
      uuid: 'b902b494-3392-4499-958b-2698b8ae411e',
      email: 'brock@sintaxi.com',
      login_at: '2011-10-23T05:18:31.229Z',
      login_count: 84,
      updated_at: '2011-09-23T02:17:26.229Z',
      created_at: '2011-09-23T02:17:26.228Z'
    }

### account.set(props, callback)

    rolodex.account.set({ "email": "brock@sintaxi.com" },
      function(errors, account){
        console.log(account)
      }
    )

### account.get(q, callback)

    rolodex.account.get("ojzg-su2w-kqsn",
      function(account){
        console.log(account)
      }
    )

OR (search by other params)

    rolodex.account.get({ "email": "brock@sintaxi" },
      function(account){
        console.log(account)
      }
    )

### account.update(q, props, callback)

    rolodex.account.set("ojzg-su2w-kqsn", { "email": "fred@sintaxi" },
      function(errors, account){
        console.log(account)
      }
    )

## Roles

Roles are arbitrary but this is the line of thinking when creating this lib.

    0 - Owners
    1 - Admin
    2 - Dev
    3 - Employee
    4 - Mod
    5 - Customer

## License

Copyright 2011/2012 Chloi Inc.
All rights reserved.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
