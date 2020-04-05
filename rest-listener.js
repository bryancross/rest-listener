'use strict';
const fs = require('fs');
const http = require('http');
const Logger = require('@bryancross/logger');
const HttpDispatcher = require('httpdispatcher');
const sysLogger = null;
const payloadLogger = null;
const PORT = process.env.PORT || 3000;
const suspended = false;

module.exports = RestListener;

function RestListener() {
	try {
        this.init();
	}
	catch(err)
	{
		if(err.code == 'ENOENT' && err.errno == -2)
		{
			this.sysLogger.syslog("No configuration found.","RepoTemplate","Exception",err);
			this.suspended = true;
		}
		else
		{
			this.sysLogger.endlog("Error initializing server","RepoTemplate","Fatal",err);
			process.exit(0);
		}
	}

	this.initHTTPServer();
}

RestListener.prototype.init = function () {
    var color = Math.floor(Math.random() * 6) + 30;
    var colorString = '\x1b[' + color + 'm';

	this.sysLogger = new Logger();
	this.payloadLogger = new Logger({syslogPath: "./log/shitbox.log",
	name: "payloadLogger",
	logPath: "./log/",
	columnSpec: {cols: [30, 40,15, 30, 50, 50], padding: 10, prefix:"SHITBOX: "},
	color:"\x1b[36m",
	mode:"json"});
	//this.payloadLogger.mode = 'json';
    /*
    this.logger = new Logger({
        "syslogPath": "./log/rest-listener.log",
        "logPath": "./log/" + this.ID + ".json",
        "columnSpec": {cols: [30, 40,15, 30, 50, 50], padding: 10, prefix:"SYSLOG: "},
        "ID":null,
        "color":"\x1b[36m"
    });
    */
    this.sysLogger.syslog('Server startup', 'init()', 'OK');
};

RestListener.prototype.initHTTPServer = function(){
	let self = this;
	this.dispatcher = new HttpDispatcher();
    this.dispatcher.onPost('/',this.handlePost);
	this.dispatcher.onGet('/',this.handleStatus);
	this.dispatcher.onGet('/suspend', this.handleSuspend);
	this.dispatcher.onGet('/resume',this.handleResume);
	

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
						this.sysLogger.syslog(this.getStatusMessage(), "createServer.dispatch","OK");
						return;
					}
					this.dispatcher.dispatch(request, response);
				} catch (err) {
					if (err.message === 'SHUTDOWN')			{
						throw err;
						}
				self.sysLogger.syslog('Error dispatching HTTP request', 'this.server.dispatcher', 'OK', err);
        		response.respond(503, "Error dispatching HTTP request",err.message);
				}
		});

	// Startup the server
	this.server.listen(PORT, () => {
		// Callback when server is successfully listening
		self.sysLogger.syslog('Server listening on: http://localhost: ' + PORT, 'init()', 'OK');
	});

	// Cleanup after ourselves if we get nerve-pinched
	process.on('SIGTERM', function () {
		this.server.close(() => {
			self.shutdown();
		});
	});
};

RestListener.prototype.handleStatus = function(req,res)
{
	let that = req.rt;
	res.respond(200,that.getStatusMessage());
	return;
}

RestListener.prototype.getStatusMessage = function(req,res)
{
	if(this.suspended)
	{
		return "Server is suspended";
	}
	else
	{
		return "Server is ACTIVE";
	}


}

RestListener.prototype.handleSuspend = function(req, res)
{
	let that = req.rt;
	that.suspended = true;
    res.respond(200,{message: 'Server SUSPEND received.  Server is suspended.'},'json');
	that.sysLogger.syslog('Server SUSPEND received.  Server is suspended.')
};

RestListener.prototype.handleResume = function(req, res)
{
    let that = req.rt
	that.suspended = false;
    res.respond(200,{message: 'Server RESUME received.  Server is resumed.'},'json');
    that.sysLogger.syslog('Server RESUME received.  Server is resumed.')
};

RestListener.prototype.handleStop = function(req,res)
{
	let that = req.rt;
	that.sysLogger.syslog('Server STOP received: ' + req.body);
	res.respond(200,{message: 'Server SHUTDOWN received'},'json');
    that.server.close(() => {
		this.shutdown();
	});
}

RestListener.prototype.handleGet = function(req,res) {
    let that = req.rt;
    res.respond(204,"GET Received");
    that.sysLogger.syslog("GET Received");

};

RestListener.prototype.handlePost = function(req,res) {
	var bodyJSON = {};
	let that = req.rt;
    that.sysLogger.syslog(req.body);
    res.respond(204,"POST Received");
	that.sysLogger.syslog("POST Received");
	try {
		bodyJSON = JSON.parse(req.body)
	}
	catch(e)
	{
		bodyJSON.msg = req.body;
	}
	//that.payloadLogger.syslog(bodyJSON);
	that.payloadLogger.log(bodyJSON);
};

