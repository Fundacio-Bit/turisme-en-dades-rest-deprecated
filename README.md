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

#### Create a collection of users in MongoDB

Create a collection in MongoDB named `users_col` (in the previously specified database in `server.config.js`), and insert a doc in the collection with the following format:

```js
{
    "username" : "<username>",
    "password" : "<password>",
    "isAdmin": [true|false]
}
```

Users are authenticated through the login endpoint in order to generate a signed JSON Web Token. JWT tokens will be passed to endpoint invocations as bearer tokens in authorization headers. Only admin users ( `isAdmin=true` ) can perform POST, PATCH and DELETE operations.

### 3. Run

```bash
node ./rest-api/server_turisme-en-dades.js
```

### 4. Endpoints

| method | path | description | schema to validate `req.body` | required JWT (*) |
|-|-|-|-|-|
| GET | / | REST API documentation |||
| POST | /login | User authentication to generate a JWT |[loginSchema](https://github.com/Fundacio-Bit/turisme-en-dades/blob/master/rest-api/schemas/loginSchema.js)||
| GET | /data-grids/summary | Read summary of data grids || Yes |
| POST | /data-grids | Create data grid |[dataGridSchema](https://github.com/Fundacio-Bit/turisme-en-dades/blob/master/rest-api/schemas/dataGridSchema.js)| Yes |
| GET | /data-grids/:id | Read data grid || Yes |
| PATCH | /data-grids/:id | Update data grid |[dataGridSchema](https://github.com/Fundacio-Bit/turisme-en-dades/blob/master/rest-api/schemas/dataGridSchema.js) (without `required` field)| Yes |
| DELETE | /data-grids/:id | Delete data grid || Yes |

(*) Pass as a bearer token in an authorization header ( `Authorization: Bearer AbCdEf123456` ).

### 5. Usage

To generate a JWT token you can use `curl` and pass the user credentials to the login endpoint:

```bash
curl -X POST -d "{\"username\":\"...\",\"password\":\"...\"}" -H "Content-Type: application/json" http://localhost:3000/login
```

To invoke CRUD endpoints you can use the generated JWT and pass it as a Bearer token in an authorization header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/data-grids/summary
```

### 6. How to build a Docker image

To build a Docker image of the REST server, execute the following command:

```bash
docker build -t <image_name> .
```

To run the image in a container:

```bash
docker run -d -p <public_port>:<private_port> <image_name>
```

Where the private port must be the same as the one defined in the `server.config.js` properties file.
