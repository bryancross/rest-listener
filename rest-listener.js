'use strict';
const fs = require('fs');
const http = require('http');
const GitHubClient = require('@octokit/rest');
//const GitHubClient = require('github'); // https://github.com/mikedeboer/node-github
//const GHClient = require('./lib/github/lib/index.js'); // https://github.com/mikedeboer/node-github
const Logger = require('./lib/logger.js');
//const HashMap = require('hashmap');
const GitHubToken = "";
const HttpDispatcher = require('httpdispatcher');
/*

const Worker = require('./worker.js');
const JSComp = require('./lib/json-compare.js');

const uNameTest = require('github-username-regex');
*/
const PORT = process.env.PORT || 3000;
const ERR_LOADING_TEMPLATE = 1;

module.exports = RestListener;

function RestListener() {
	try {
        this.init();
	}
	catch(err)
	{
		if(err.code == 'ENOENT' && err.errno == -2)
		{
			this.logger.syslog("No configuration found.","RepoTemplate","Exception",err);
			this.suspended = true;
		}
		else
		{
			this.logger.endlog("Error initializing server","RepoTemplate","Fatal",err);
			process.exit(0);
		}
	}

	this.initHTTPServer();
}

RestListener.prototype.init = function () {
    var color = Math.floor(Math.random() * 6) + 30;
    var colorString = '\x1b[' + color + 'm';

	this.logger = new Logger({
        "syslogPath": "./log/rest-listener.log",
        "logPath": "./log/" + this.ID + ".json",
        "columnSpec": {cols: [30, 40,15, 30, 50, 50], padding: 10, prefix:"SYSLOG: "},
        "ID":null,
        "color":"\x1b[36m"
    });
    this.logger.syslog('Server startup', 'init()', 'OK');
};

RestListener.prototype.initHTTPServer = function(){
	let self = this;
	this.dispatcher = new HttpDispatcher();
    this.dispatcher.onPost('/',this.handlePost);
    this.dispatcher.onGet('/',this.handleGet);

	this.server = http.createServer((request, response) => {
			try {
                request.rt = self;
    			//request.respond = self.respond;

				response.respond = function(status, msg, format, err) {
                    if (typeof format == 'undefined') //default is JSON
                    {
                        try {
                            JSON.parse(msg);
                            format = 'json'
                        }
                        catch(err)
						{
							msg = {message: msg};
							format = 'json'
						}
                    }
					if (format == 'json')
					{
						format = 'application/json';
					}
					else if (format == 'html')
					{
						format = 'text/html';
					}
					else
					{
						format = 'text/plain';
					}


                    if (typeof err != 'undefined') {
                        this.error = err;
                    }
                    this.writeHead(status, {'Content-Type': format});
                    this.end((format === 'application/json' ? JSON.stringify(msg) : msg));
                	};

				// Dispatch
					if (self.suspended
						&& request.url !== '/resume'
						&& request.url !== '/init'
						&& request.url !== '/reloadConfig')
					{
						response.respond(503, this.getStatusMessage());
						this.logger.syslog(this.getStatusMessage(), "createServer.dispatch","OK");
						return;
					}
					this.dispatcher.dispatch(request, response);
				} catch (err) {
					if (err.message === 'SHUTDOWN')			{
						throw err;
						}
				self.logger.syslog('Error dispatching HTTP request', 'this.server.dispatcher', 'OK', err);
        		response.respond(503, "Error dispatching HTTP request",err.message);
				}
		});

	// Startup the server
	this.server.listen(PORT, () => {
		// Callback when server is successfully listening
		self.logger.syslog('Server listening on: http://localhost: ' + PORT, 'init()', 'OK');
	});

	// Cleanup after ourselves if we get nerve-pinched
	process.on('SIGTERM', function () {
		this.server.close(() => {
			self.shutdown();
		});
	});
};

RestListener.prototype.handleGet = function(req,res) {
    let that = req.rt;
    res.respond(204,"GET Received");
    that.logger.log("GET Received");

};

RestListener.prototype.handlePost = function(req,res) {
    let that = req.rt;
    that.logger.log(req.body);
    res.respond(204,"POST Received");
    that.logger.log("POST Received");
};

RestListener.prototype.handleStop = function(req,res)
{
	let that = req.rt;
    this.logger.syslog('Server STOP received: ' + msg);
    this.server.close(() => {
		self.shutdown();
	});
};