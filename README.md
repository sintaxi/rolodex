# rolodex 

## Instalation

I always recomend you bundle your dependencies with your application. To do
this, create a `package.json` file in the root of your project with the minimum
information...

    {
      "name": "yourapplication",
      "version": "0.1.0",
      "dependencies": {
        "rolodex": "0.5.8"
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

Anytime errors are accepted as the first argument of the callback it will return
`null` if the request was successful and if there are validation errors it will
look like the following...

    {
      fields: {
        "password": "is required",
        "username": "must be unique"
      },
      messages: [
        "Password is required",
        "Username must be unique"
      ]
    }

### Account

Account Object looks like the following...

    { 
      id: 1,
      uuid: 'b902b494-3392-4499-958b-2698b8ae411e',
      username: 'sintaxi',
      email: 'brock@sintaxi.com',
      hash: 'syJ2nuUfD6bc4852829dcfa5752f300e19161a156',
      login_at: '2011-10-23T05:18:31.229Z',
      login_count: 84,
      updated_at: '2011-09-23T02:17:26.229Z',
      created_at: '2011-09-23T02:17:26.228Z'
    }

### account.create(props, callback)

    rolodex.account.create(
      {
        "email": "brock@sintaxi.com",
        "username": "sintaxi",
        "password": "something"
      },
      function(errors, account){
        console.log(account)
      }
    )

### account.update(id, props, callback)

    rolodex.account.update(1, { "username": "sintaxi" },
      function(errors, account){
        console.log(account)
      }
    )

### account.authenticate(username, password, callback)

    rolodex.account.authenticate("sintaxi", "something",
      function(errors, account){
        console.log(account)
      }
    )

### account.getById(id, callback)

    rolodex.account.getById(12,
      function(account){
        console.log(account)
      }
    )

### account.getByUsername(username, callback)

    rolodex.account.getById(
      "sintaxi",
      function(account){
        console.log(account)
      }
    )

### account.getByUUID(uuid, callback)

    rolodex.account.getByUUID(
      "550e8400-e29b-41d4-a716-446655440000", 
      function(account){
        console.log(account)
      }
    )

### account.getByEmail(email, callback)

    rolodex.account.getByEmail(
      "brock@sintaxi.com", 
      function(account){
        console.log(account)
      }
    )

## License

Copyright 2011 Brock Whitten
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
