// Runs only when the MongoDB data volume is empty.
const appDb = db.getSiblingDB('transparency_check');
appDb.createUser({
	user: 'transparencycheck',
	pwd: process.env.MONGO_APP_PASSWORD,
	roles: [{ role: 'readWrite', db: 'transparency_check' }]
});
