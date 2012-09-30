# rolodex

## Instalation

I always recomend you bundle your dependencies with your application. To do
this, create a `package.json` file in the root of your project with the
minimum information...

    {
      "name": "yourapplication",
      "version": "0.1.0",
      "dependencies": {
        "rolodex": "0.7.1"
      }
    }

Then run the following command using npm...

    npm install

OR, if you just want to start playing with the library run...

    npm install rolodex

## Docs

To create a rolodex object that gives us user management functions we must pass
in our redis credentials to the redis server we wish to connect to.

    var rolodex = require("rolodex")(redisArgs)

Now we have rolodex.account object that gives us account management functions.

### Errors

Anytime errors are accepted as the first argument of the callback it will
return `null` if the request was successful and if there are validation
errors it will look like the following...

    {
      messages: [
        "Email must be unique"
        "Password confirmation must match"
      ],
      details: {
        "email": "must be unique"
        "password": "confirmation must match"
      }
    }

### Account

Account Object looks like the following...

    { 
      id: 'ojzg-su2w-kqsn',
      uuid: 'b902b494-3392-4499-958b-2698b8ae411e',
      email: 'brock@sintaxi.com',
      email_verified_at: '2011-09-23T02:17:26.229Z',
      updated_at: '2011-09-23T02:17:26.229Z',
      created_at: '2011-09-23T02:17:26.228Z'
    }

The account object gives you to basic functions `set` and `get`. The

### account.set([identifier,] props, callback)

If an identifier is provied, the set will perform an update on that record.
If no identifier is profided, it will create the record.

    rolodex.account.set({ "email": "brock@sintaxi.com" },
      function(errors, account){
        console.log(account)
      }
    )

### account.get(identifier, callback)

    rolodex.account.get("ojzg-su2w-kqsn",
      function(account){
        console.log(account)
      }
    )

The following are possible values for identifier.

  - account id (String). eg "ojzg-su2w-kgsn"
  - uuid key value pair (Object). eg `{ uuid: "fdc7af2d-f3c2-4475-bb1c-7a17caed3564"}`  
  - email key value pair (Object). eg `{ email: "hey@man.com"}`  

Eg. (find by params other than id)

    rolodex.account.get({ "email": "brock@sintaxi" },
      function(account){
        console.log(account)
      }
    )

### Account Creation

There is two ways to create an account...

1) Provide a password and password\_confirmation along with email. This would
be for your standard account registration paradigm.

2) If you are creating the account with a previously verified email you can
bypass the password requirement by passing in a `{ email_verified: true }`.
This is suitable when authentication was done via browserid or any other 3rd
party authentication system that requires an email verification step. If this
step is chosen, the `email_verified_at` timestamp will be set.


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
