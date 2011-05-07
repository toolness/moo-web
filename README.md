# Introduction

This is an attempt to run a [MOO][] server with a Web interface similar to
[Parchment][]. It's basically just some client-side JS that communicates with
a [Node][] server via [Socket.io][], which itself forwards input from a MOO
served via a unix domain socket.

The server automatically takes care of starting the MOO server process,
performing MOO database file rotation, and cleanly shutting down the MOO
server on `SIGINT`.

MOO was chosen instead of creating a similar engine from-scratch due to its
maturity and extensive documentation.

# Installation

This code has only been tested with Node v0.3.6 and Socket.io v0.6.8.

Make sure Socket.io is available at the `socket.io` directory.

Enter the `moo` directory and run `./configure && make`.

You'll probably want to create a file called `config.local.json` that contains
something akin to the following:

    {
      "moo": {
        "dbFile": "moo/LambdaCore-latest.db"
      },
      "key": "key.pem",
      "cert": "cert.pem",
      "ca": "ca.pem"
    }

If you don't want to serve over SSL, leave out the `key`, `cert`, and `ca`
information.

Once all this is done, run `node server.js` to start the server, and then open
your browser to 127.0.0.1:7777.

# Limitations

Actually creating anything worthwhile on the MOO requires an easier editing
interface, which this project currently lacks.

  [Parchment]: http://www.toolness.com/wp/2008/06/introducing-parchment/
  [MOO]: http://en.wikipedia.org/wiki/MOO
  [Node]: http://nodejs.org/
  [Socket.io]: http://socket.io/
