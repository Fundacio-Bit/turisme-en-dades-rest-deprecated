module.exports = {

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

}
