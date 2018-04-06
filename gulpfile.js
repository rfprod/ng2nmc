'use strict';

const gulp = require('gulp'),
	runSequence = require('run-sequence'),
	util = require('gulp-util'),
	concat = require('gulp-concat'),
	rename = require('gulp-rename'),
	eslint = require('gulp-eslint'),
	tslint = require('gulp-tslint'),
	plumber = require('gulp-plumber'),
	mocha = require('gulp-mocha'),
	karmaServer = require('karma').Server,
	uglify = require('gulp-uglify'),
	sass = require('gulp-sass'),
	cssnano = require('gulp-cssnano'),
	autoprefixer = require('gulp-autoprefixer'),
	systemjsBuilder = require('gulp-systemjs-builder'),
	hashsum = require('gulp-hashsum'),
	crypto = require('crypto'),
	fs = require('fs'),
	spawn = require('child_process').spawn,
	exec = require('child_process').exec;
let node,
	mongo,
	tsc;

function killProcessByName(name) {
	exec('pgrep ' + name, (error, stdout, stderr) => {
		if (error) {
			// throw error;
			console.log('killProcessByName, error', error);
		}
		if (stderr) console.log('stderr:', stderr);
		if (stdout) {
			//console.log('killing running processes:', stdout);
			const runningProcessesIDs = stdout.match(/\d{3,6}/);
			runningProcessesIDs.forEach((id) => {
				exec('kill ' + id, (error, stdout, stderr) => {
					if (error) throw error;
					if (stderr) console.log('stdout:', stdout);
					if (stdout) console.log('stderr:', stderr);
				});
			});
		}
	});
}

/*
*	hashsum identifies build
*
*	after build SHA1SUMS.json is generated with sha1 sums for different files
*	then sha256 is calculated using stringified file contents
*/
gulp.task('hashsum', () => {
	return gulp.src(['./public/*', '!./public/SHA1SUMS.json', './public/app/views/**', './public/css/**', './public/fonts/**', './public/img/**', './public/js/**'])
		.pipe(hashsum({ filename: 'public/SHA1SUMS.json', hash: 'sha1', json: true }));
});

function setEnvBuildHash(env, done) {
	fs.readFile('./public/SHA1SUMS.json', (err, data) => {
		if (err) throw err;
		const hash = crypto.createHmac('sha256', data.toString()).digest('hex');
		console.log('BUILD_HASH', hash);
		env += 'BUILD_HASH=' + hash + '\n';
		fs.writeFile('./.env', env, (err) => {
			if (err) throw err;
			console.log('# > ENV > .env file was updated');
			done();
		});
	});
}

gulp.task('set-build-hash', (done) => {
	fs.readFile('./.env', (err, data) => {
		let env = '';
		if (err) {
			console.log('./.env does not exist');
			setEnvBuildHash(env, done);
		} else {
			env = data.toString().replace(/BUILD_HASH=.+\n/, '');
			console.log('./.env exists, updated env', env);
			setEnvBuildHash(env, done);
		}
	});
});

gulp.task('database', (done) => {
	if (mongo) mongo.kill();
	mongo = spawn('npm', ['run','mongo-start'], {stdio: 'inherit'});
	mongo.on('close', (code) => {
		if (code === 8) {
			console.log('Error detected, waiting for changes...');
		}
	});
	done();
});

gulp.task('server', (done) => {
	if (node) node.kill();
	node = spawn('node', ['server.js'], {stdio: 'inherit'});
	node.on('close', (code) => {
		if (code === 8) {
			console.log('Error detected, waiting for changes...');
		}
	});
	done();
});

gulp.task('tsc', (done) => {
	if (tsc) tsc.kill();
	tsc = spawn('tsc', [], {stdio: 'inherit'});
	tsc.on('close', (code) => {
		if (code === 8) {
			console.log('Error detected, waiting for changes...');
		} else {
			done();
		}
	});
});

gulp.task('server-test', () => {
	return gulp.src(['./test/server/*.js'], { read: false })
		.pipe(mocha({ reporter: 'spec' }))
		.on('error', util.log);
});

gulp.task('client-unit-test', (done) => {
	const server = new karmaServer({
		configFile: require('path').resolve('test/karma.conf.js'),
		singleRun: false
	});

	server.on('browser_error', (browser, err) => {
		console.log('=====\nKarma > Run Failed\n=====\n', err);
		throw err;
	});

	server.on('run_complete', (browsers, results) => {
		if (results.failed) {
			throw new Error('=====\nKarma > Tests Failed\n=====\n', results);
		}
		console.log('=====\nKarma > Complete With No Failures\n=====\n', results);
		done();
	});

	server.start();
});

gulp.task('client-unit-test-single-run', (done) => {
	const server = new karmaServer({
		configFile: require('path').resolve('test/karma.conf.js'),
		singleRun: true
	});

	server.on('browser_error', (browser, err) => {
		console.log('=====\nKarma > Run Failed\n=====\n', err);
		throw err;
	});

	server.on('run_complete', (browsers, results) => {
		if (results.failed) {
			throw new Error('=====\nKarma > Tests Failed\n=====\n', results);
		}
		console.log('=====\nKarma > Complete With No Failures\n=====\n', results);
		done();
	});

	server.start();
});

gulp.task('build-system-js', () => {
	/*
	*	this task builds angular application
	*	components, angular modules, and some dependencies
	*
	*	nonangular components related to design, styling, data visualization etc.
	*	are built by another task
	*/
	return systemjsBuilder('/','./systemjs.config.js')
		.buildStatic('app', 'bundle.min.js', {
			minify: true,
			mangle: true
		})
		.pipe(gulp.dest('./public/js'));
});

gulp.task('pack-vendor-js', () => {
	/*
	*	nonangular js bundle
	*	components related to design, styling, data visualization etc.
	*/
	return gulp.src([
		// sequence is essential
		'./node_modules/jquery/dist/jquery.js',
		'./node_modules/bootstrap/dist/js/bootstrap.js',
		'./node_modules/d3/d3.js',
		'./node_modules/nvd3/build/nv.d3.js',
		// angular dependencies start here
		'./node_modules/zone.js/dist/zone.min.js',
		'./node_modules/reflect-metadata/Reflect.js',
		'./node_modules/web-animations-js/web-animations.min.js'
	])
		.pipe(plumber())
		.pipe(concat('vendor-bundle.js'))
		.pipe(uglify())
		.pipe(plumber.stop())
		.pipe(rename('vendor-bundle.min.js'))
		.pipe(gulp.dest('./public/js'));
});

gulp.task('pack-vendor-css', () => {
	return gulp.src([
		'./node_modules/bootstrap/dist/css/bootstrap.css',
		'./node_modules/bootstrap/dist/css/bootstrap-theme.css',
		'./node_modules/nvd3/build/nv.d3.css',
		'./node_modules/components-font-awesome/css/font-awesome.css'
	])
		.pipe(plumber())
		.pipe(concat('vendor-bundle.css'))
		.pipe(cssnano())
		.pipe(plumber.stop())
		.pipe(rename('vendor-bundle.min.css'))
		.pipe(gulp.dest('./public/css'));
});

gulp.task('move-vendor-fonts', () => {
	return gulp.src([
		'./node_modules/bootstrap/dist/fonts/*.*',
		'./node_modules/components-font-awesome/fonts/*.*'
	])
		.pipe(gulp.dest('./public/fonts'));
});

gulp.task('sass-autoprefix-minify-css', () => {
	return gulp.src('./public/app/scss/*.scss')
		.pipe(plumber())
		.pipe(concat('packed-app.css'))
		.pipe(sass().on('error', sass.logError))
		.pipe(autoprefixer({
			browsers: ['last 2 versions']
		}))
		.pipe(cssnano())
		.pipe(plumber.stop())
		.pipe(rename('bundle.min.css'))
		.pipe(gulp.dest('./public/css'));
});

gulp.task('eslint', () => {
	return gulp.src(['./app/**', './public/js/*.js', './*.js']) // uses ignore list from .eslintignore
		.pipe(eslint('./.eslintrc.json'))
		.pipe(eslint.format());
});

gulp.task('tslint', () => {
	return gulp.src(['./public/app/*.ts', './public/app/**/*.ts'])
		.pipe(tslint({
			formatter: 'verbose' // 'verbose' - extended info | 'prose' - brief info
		}))
		.pipe(tslint.report({
			emitError: false
		}));
});

gulp.task('watch', () => {
	gulp.watch(['./server.js', './app/**/*.js'], ['server']);
	gulp.watch(['./test/server/test.js'], ['server-test']);
	gulp.watch(['./server.js', './app/models/*.js'], ['database']);
	gulp.watch(['./gulpfile.js'], ['pack-vendor-js', 'pack-vendor-css', 'move-vendor-fonts']);
	gulp.watch('./public/app/scss/*.scss', ['sass-autoprefix-minify-css']);
	gulp.watch(['./public/app/*.ts', './public/app/**/*.ts', './test/client/**/*.ts', './tslint.json'], ['spawn-rebuild-app']);
	gulp.watch(['./app/**', './public/js/*.js', './*.js', './.eslintignore', './.eslintrc.json'], ['eslint']);
});

gulp.task('watch-and-lint', () => {
	gulp.watch(['./app/**', './public/js/*.js', './*.js', './.eslintignore', './.eslintrc.json'], ['eslint']); // watch files to be linted or eslint config files and lint on change
	gulp.watch(['./public/app/*.ts', './public/app/**/*.ts', './tslint.json'], ['tslint']); // watch files to be linted or eslint config files and lint on change
});

gulp.task('watch-client-and-test', () => {
	gulp.watch(['./public/app/*.ts','./test/client/*.ts'], ['tsc']); //watch unit test changes and run tests
	gulp.watch(['./public/app/*.js','./test/client/*.js','./test/karma.conf.js','./test/karma.test-shim.js'], ['client-unit-test']); //watch unit test changes and run tests
});

gulp.task('build', (done) => {
	runSequence('build-system-js', 'pack-vendor-js', 'pack-vendor-css', 'move-vendor-fonts', 'sass-autoprefix-minify-css', 'hashsum', 'set-build-hash', done);
});

gulp.task('compile-and-build', (done) => {
	runSequence('tsc', 'build', done);
});

gulp.task('rebuild-app', (done) => { // should be used in watcher to rebuild the app on *.ts file changes
	runSequence('tslint', 'compile-and-build', done);
});

let rebuildApp;
gulp.task('spawn-rebuild-app', (done) => {
	if (rebuildApp) rebuildApp.kill();
	rebuildApp = spawn('gulp', ['rebuild-app'], {stdio: 'inherit'});
	rebuildApp.on('close', (code) => {
		console.log(`rebuildApp closed with code ${code}`);
	});
	done();
});

gulp.task('lint', (done) => {
	runSequence('eslint', 'tslint', done);
});

gulp.task('default', (done) => {
	runSequence('lint', 'compile-and-build', 'database', 'server', 'watch', done);
});

process.on('exit', (code) => {
	console.log(`PROCESS EXIT CODE ${code}`);
	// killProcessByName('gulp');
});
