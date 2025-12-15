module.exports = {
  apps: [{
    name: 'transparencycheck',
    script: 'build/index.js',
    node_args: '-r dotenv/config'
  }]
}