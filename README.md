# Turisme en Dades

A dashboard tool to publish tourism data indicators, created with Node.js and React.

## REST API

### 1. Install

#### Install Node.js dependencies

```bash
npm install
```

#### Install Redis

Install Redis on Windows: https://riptutorial.com/redis/example/29962/installing-and-running-redis-server-on-windows

Install Redis on Ubuntu: https://hostpresto.com/community/tutorials/how-to-install-and-configure-redis-on-ubuntu-14-04/

#### Install MongoDB

https://docs.mongodb.com/manual/installation/

### 2. Configuration

#### Environment variables

Edit the file `.env.example` to define the environment variables and rename it to `.env`:

| environment variable | description |
|-|-|
| `SECRET_KEY` | Secret key to sign/verify JWT's in the authentication process |
| `NODE_ENV` | Execution mode. Allowed values: `development`, `production` |
| `RUNNING_IN_DOCKER` | To indicate Docker execution in a container. Allowed values: `true`, `false` |

#### Configure the file `server.config.js`

Edit the file to add MongoDB, Redis and REST server properties:

```js
// Mongo properties
mongodbUri: process.env.RUNNING_IN_DOCKER === 'true' ? 'mongodb://host.docker.internal:27017' : 'mongodb://127.0.0.1:27017',
db: 'turisme_en_dades_db',
collection: 'data_grids_col',

// Redis properties
redisHost: process.env.RUNNING_IN_DOCKER === 'true' ? 'host.docker.internal' : '127.0.0.1',
redisDBindex: 0,
expiration: 600,  // Number of seconds of expiraton time for Redis caches

// REST server properties
port: 3000
```

#### Create a collection of admin users in MongoDB

Create a collection in MongoDB named `admins_col` (in the previously created database), and insert a doc in the collection with the following format:

```js
{
    "username" : "<username>",
    "password" : "<password>",
    "isAdmin": [true|false]
}
```

This users are required to invoke the login endpoint in order to generate a signed JSON Web Token. Tokens must be passed in endpoint invocations, as a bearer token in authorization header, in order to authenticate users.

### 3. Run

```bash
node ./rest-api/server.js
```

### 4. Endpoints

| method | path | description | schema to validate `req.body` | required JWT (*) |
|-|-|-|-|-|
| GET | / | REST API documentation |||
| POST | /login | User authentication to generate a JWT |[loginSchema](https://github.com/Fundacio-Bit/turisme-en-dades/blob/master/rest-api/schemas/loginSchema.js)||
| GET | /data-grids/summary | Read summary of data grids || Yes |
| POST | /data-grids | Create data grid |[dataGridSchema](https://github.com/Fundacio-Bit/turisme-en-dades/blob/master/rest-api/schemas/dataGridSchema.js)| Yes |
| GET | /data-grids/:id | Read data grid || Yes |
| PATCH | /data-grids/:id | Update data grid |[dataGridSchema](https://github.com/Fundacio-Bit/turisme-en-dades/blob/master/rest-api/schemas/dataGridSchema.js) (without `required`)| Yes |
| DELETE | /data-grids/:id | Delete data grid || Yes |

(*) As a Bearer token in `Authorization` header

### 5. Usage

To generate a JWT token you can use `curl` and pass the user credentials to the login endpoint:

```bash
curl -X POST -d "{\"username\":\"...\",\"password\":\"...\"}" -H "Content-Type: application/json" http://localhost:3000/login
```

To invoque CRUD endpoints you can use the generated JWT and pass it as a Bearer token in an authorization header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/data-grids/summary
```
