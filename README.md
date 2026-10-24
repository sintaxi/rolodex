# rolodex

## Instalation

I always recomend you bundle your dependencies with your application. To do
this, create a `package.json` file in the root of your project with the
minimum information...

    {
      "name": "yourapplication",
      "version": "0.1.0",
      "dependencies": {
        "rolodex": "0.8.0"
      }
    }

Then run the following command using npm...

    npm install

OR, if you just want to start playing with the library run...

    npm install rolodex

## Docs

To create a rolodex object that gives us user management functions we must pass
in a configuration object.

    var rolodex = require("rolodex")(config)

## Configuration

Rolodex can run in two different modes. `master` and `slave`.

Example of master configuration object...

    {
      "role": "master",
      "email": {
        "postmark": "dc2d8r99-771e-4d6f-95b8-3403e1bd5poi",
        "defaults": {
          "from"    : "thurston.moore@sonicyouth.com",
          "reply_to": "kim@sonicyouth.com"
        }
      },
      "redis": {
        ...
      }
    }

Example of master configuration object...

    {
      "role": "slave",
      "master": {
        ...
      }
    }

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

The account object gives you two basic functions `set` and `get`. The

### account.set([identifier,] props, callback)

You are to provide an identifier if you wish to update the record.
Otherwise rolodex will assume a new record is being created.

There are two ways to create an account.

1) Pass in `email_verified` property with the value `true`. This is
when authentication has been done with a third party service such as
Mozilla's Persona.

    var validAccount = {
      "email": "brock@sintaxi.com",
      "email_verified": true
    }

2) The other option is to pass in `password` and `password_confirmation`
properties. When this is the case, email will assume to be unverified.

    var validAccount = {
      "email": "brock@sintaxi.com",
      "password": "secret",
      "password_confirmation": "secret"
    }

The set command with either object will create an account.

    rolodex.account.set(validAccount, function(errors, account){
      console.log(account)
    })

Some facts about an account are set once and never cleared. Passing
the flag stamps a time the first time; passing it again changes nothing.

- `payment_verified: true` sets `payment_verified_at`, when a payment
  method was first proven.
- `bot: "<platform>"` sets `bot` and `bot_at`: the account is operated
  by software with its own identity (`grok`, `instinct`, or `unknown`).
  The label is 1-32 lowercase letters, digits or dashes, and the first
  one recorded is kept. An account without `bot` is a person.

      rolodex.account.set({ email: "agent@mail.grokbot.com" }, { bot: "grok" }, function(errors, account){
        console.log(account.bot, account.bot_at)
      })

### account.get(identifier, callback)

    rolodex.account.get("ojzg-su2w-kqsn", function(account){
      console.log(account)
    })

The following are possible values for identifier.

  - account id (String). eg "ojzg-su2w-kgsn"
  - uuid key value pair (Object). eg `{ uuid: "fdc7af2d-f3c2-4475-bb1c-7a17caed3564"}`
  - email key value pair (Object). eg `{ email: "hey@man.com"}`

eg. (find by params other than id)

    rolodex.account.get({ "email": "brock@sintaxi" }, function(account){
      console.log(account)
    })

### account.validate([identifier,] object, callback)

Validate is very similar to the set method except that it does not write to the store.

    rolodex.account.validate({}, function(errors, account){
      console.log(errors)
    })

### account.email(callback)

Emails a user if a record is found in the system

    rolodex.account.email({ "uuid": "fdc7af2d-f3c2-4475-bb1c-7a17caed3564" }, function(errors, message){
      console.log(message)
    })

### account.all(callback)

Gets all accounts

    rolodex.account.all(function(accounts){
      console.log(accounts)
    })

### account.group(role, callback)

Returns all records that match that role.

    rolodex.account.group(3, function(accounts){
      console.log(accounts)
    })

### account.authenticate(identifier, password, callback)

Authenticates the account. If successful, the account will be returned.

    rolodex.account.authenticate({ email: "brock@sintaxi.com" }, "secret", function(errors, account){
      console.log(account)
    })

## Orgs

An org is a container of accounts with roles (`admin` or `member`). Its
id never changes; domains, money and tokens elsewhere refer to that id.
The slug and name can both be renamed. An org holds one live slug. The
slug a rename leaves behind is protected for 30 days: it still resolves
to the org and no other org can take it. After that it's a soft alias,
resolving to the org until another org claims it. Only one old slug is
protected at a time, so renaming again turns the previous one into a soft
alias straight away. Deleting an org releases its slugs at once.

Slugs are 3-63 lowercase letters, digits or dashes, with no dash at
either end. Reserved words (`http`, `https`, `www`, `api`, `admin`,
`support`, `docs`, `status` and others in `models/org.js`) and anything
reading as surge itself (`surge`, `surge-*`) are refused. Names are 1-64
characters.

Every write is atomic: slugs are unique, an org always has at least one
admin, and caps are checked in the same write. Caps are passed in by the
caller. Orgs are master only: slave mode has no org methods.

### org.create(props, callback)

`props`: `slug`, `name`, `admin` (account id, the first admin), and
optionally `members` (`{ accountId: role }`) and `adminCap` (how many orgs
the admin may administer).

    rolodex.org.create({ slug: "acme", name: "Acme", admin: personId, members: { [botId]: "member" } }, function(errors, org){
      console.log(org.id, org.slug, org.name)
    })

### org.get(idOrSlug, callback)

Finds an org by id, by its live slug, or by an old slug that still
resolves to it. A deleted org isn't found.

### org.rename(id, { slug, name }, callback)

Either or both. The id stays the same; the old slug is protected for 30
days, then resolves as a soft alias until another org claims it.

### org.members(id, callback)

`{ accountId: role }`.

### org.setMember(id, accountId, role, [{ cap }], callback)

Adds an account or changes its role. `cap` limits members per org (role
changes don't count). Demoting the last admin is refused.

### org.removeMember(id, accountId, callback)

Removing the last admin is refused.

### org.ofAccount(accountId, callback)

The account's orgs, each with the account's `role`.

### org.del(id, callback)

Leaves a tombstone: the org stops resolving, its members are released,
and its slugs are free for anyone at once. Whether it may be deleted (does it still own
anything?) is the caller's check.

Deleting an account is refused while it is the only admin of an org;
otherwise the account leaves every org first.

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
