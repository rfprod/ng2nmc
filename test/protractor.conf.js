exports.config = {

	useAllAngular2AppRoots: true,

	onPrepare: function() {
		browser.driver.get('http://localhost:8080/public/index.html');

		return browser.getProcessedConfig().then((config) => {
			// console.log('config:', config);
		});
	},

	specs: [
		'e2e/*.js'
	],

	capabilities: {
		/*
		*	headless chrome testing
		*	removed PhantomJS from here completely because of errors for unknown reasons
		*	which comsume way too much time to deal with
		*/
		browserName: 'chrome',
		chromeOptions: {
			args: [ '--headless', '--disable-gpu', '--window-size=1024x768' ]
		}
	},

	chromeOnly: false,

	directConnect: false,

	baseUrl: 'http://localhost:8080/',

	framework: 'jasmine',

	allScriptsTimeout: 5000000,

	getPageTimeout: 5000000,

	jasmineNodeOpts: {
		showColors: true,
		defaultTimeoutInterval: 30000
	}
};
