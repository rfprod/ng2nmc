'use strict';

const path = process.cwd();

module.exports = function(app, cwd, passport, User, SrvInfo, DataInit, mailTransporter) { // eslint-disable-line no-unused-vars

/*
*	check if data init is needed
*	data is initialized with dummy data if the DB is empty on server start
*/

	DataInit.initData();

	/*
	*	email sender example
	*/
	let mailOptions = {};
	function sendEmail(recipientEmail) {
		mailOptions = {
			from: '"NG2NMC 👥" <'+process.env.MAILER_EMAIL+'>', // sender address
			to: recipientEmail, //'bar@blurdybloop.com, baz@blurdybloop.com', // accepts list of receivers
			subject: 'Subject: some text ✔', // Subject line
			text: 'NG2NMC: sample message to recipient email: '+recipientEmail+'.', // plaintext body
			html: '<h3>NG2NMC</h3><p>Sample message to recipient email: '+recipientEmail+'..</p>' // html body
		};
		mailTransporter.sendMail(mailOptions, function(err, info) {
			if(err) {return console.log(err);}
			console.log('Message sent: ' + info.response);
		});
	}

	// eslint-disable-next-line
/*
*	routes
*/

	app.get('/', (req, res) => {
		res.sendFile(path + '/public/index.html');
	});

	app.get('/service-worker.js', (req, res) => {
		res.sendFile(cwd + '/public/service-worker.js');
	});

	app.get('/api/app-diag/hashsum', (req, res) => {
		console.log('process.env.BUILD_HASH', process.env.BUILD_HASH);
		res.json({ hashsum: process.env.BUILD_HASH || 'NA' });
	});

	app.get('/api/dummy', (req, res) => {
		const headers = req.headers;
		console.log('headers', headers);
		const output = [{key: 'Success', y:1}];

		res.format({
			'application/json': () => {
				res.send(output);
			}
		});
	});
	
	app.get('/api/users', (req, res) => {
		User.find({}, (err, docs) => {
			if (err) { throw err; }
			console.log('users list', docs);
			let resData = [],
				dataUnit = {};
			for (let i in docs) {
				if (docs[i]) {
					dataUnit = {
						id: docs[i].id,
						role:	docs[i].role,
						registered:	docs[i].registered,
						lastLogin: docs[i].lastLogin,
						email: docs[i].userExtended.email,
						firstName: docs[i].userExtended.firstName,
						lastName: docs[i].userExtended.lastName,
						city: docs[i].userExtended.city,
						country: docs[i].userExtended.country
					};
					resData.push(dataUnit);
				}
			}
			res.format({
				'application/json': () => {
					res.send(resData);
				}
			});
		});
	});

	app.get('/api/app-diag/usage', (req, res) => {
		User.find({}, (err, docs) => {
			if (err) { throw err; }
			console.log('count list', docs.length);
			let stats = [
				{ key: 'Users', y: 0},
				{ key: 'Admins', y: 0}
			];
			for (let i in docs) {
				if (docs[i]) {
					if (docs[i].role === 'admin') stats[1].y++;
					else stats[0].y++;
				}
			}
			res.format({
				'application/json': () => {
					res.send(stats);
				}
			});
		});
	});

	app.get('/api/app-diag/static', (req, res) => {
		res.format({
			'application/json': () => {
				res.send(SrvInfo['static']());
			}
		});
	});

	app.ws('/api/app-diag/dynamic', (ws) => {
		console.log('websocket opened /app-diag/dynamic');
		let sender = null;
		ws.on('message', (msg) => {
			console.log('message:',msg);
			function sendData () {
				ws.send(JSON.stringify(SrvInfo['dynamic']()), (err) => {if (err) throw err;});
			}
			if (JSON.parse(msg).action === 'get') {
				console.log('ws open, data sending started');
				sendData();
				sender = setInterval(() => {
					sendData();
				}, 5000);
			}
			if (JSON.parse(msg).action === 'pause') {
				console.log('ws open, data sending paused');
				clearInterval(sender);
			}
		});
		ws.on('close', () => {
			console.log('Persistent websocket: Client disconnected.');
			if (ws._socket) {
				ws._socket.setKeepAlive(true);
			}
			clearInterval(sender);
		});
		ws.on('error', () => {console.log('Persistent websocket: ERROR');});
	});
};
