/**
 * Created by bryancross on 1/14/17.
 */

const fs = require('fs');
const jsonComparer = require('../lib/json-compare');
const format = require('date-fns/format');  // https://github.com/date-fns/date-fns
const Columnizer = require('./columnizer.js');
const extend = require('util')._extend;
const jpp = require('json-path-processor');
const defMode = "log";
const logModes = {
	JSON: 'json'
	,LOG: 'log'
};
const defConfig = {"syslogPath": "./log/rest-listener.log",
							"logPath": "./log/",
							"name":"syslog",
							"columnSpec": {cols: [30, 40,15, 30, 50, 50], padding: 10, prefix:"SYSLOG: "},
							"color":"\x1b[36m",
							"mode":"log"};
var status = 'open';

function Logger() {
	return Logger(this.defConfig);
}

function Logger(config) {
	//self = this;
	
	this.logData = {};
	this.logConfig = defConfig;
	if(config != null)
	{
		this.logConfig = config;
	}
	
	/*
	if(logConfig.color)
	{
		this.logConfig.color = logConfig.color;
	}
	*/
	if(this.logConfig.columnSpec && this.logConfig.mode == 'log')
	{
        this.columnizer = new Columnizer(this.logConfig.columnSpec);
	}

	if(!this.logConfig.ID)
	{
		this.logConfig.ID = Date.now().toString();
		this.logData.ID = this.logConfig.ID;
		this.logConfig.logPath = this.logConfig.logPath + this.logConfig.name + "-" + this.logConfig.ID + ".json";
	}
    var logpath = this.logConfig.logPath.split('/');
    var logdir = logpath[logpath.length - 2];
    if(!fs.existsSync(logdir)){
        fs.mkdirSync(logdir);
    }

}

module.exports = Logger;

Logger.prototype.log = function (msg, execPoint, status, error) {
	if(!msg == 'undefined')
	{
		msg = "no msg supplied";
	}
	if(!execPoint)
	{execPoint = "no execPoint supplied";};
	if(!status)
	{
		status = "no status supplied";
	}
	const datestamp = format(new Date());
	if(!this.logData.msgs)
	{
		this.logData.msgs = [];
	}
	if(!this.logData.errors)
	{
		this.logData.errors = [];
	}
		if (status) {
			this.logData.status = status;
		}
		const logEntry = {time: datestamp, ID:(this.logData.ID ? this.logData.ID : 'no ID'), msg:msg, execPoint:execPoint, status:status, error: (error ? error : '')};
		this.logData.msgs.push(logEntry);
		try {
            if (error && typeof(error) == 'string') {
                this.logData.errorMessage = error;
                this.logData.errors.push(error);
            }
            else if (error && typeof(error) == 'object' && Object.prototype.toString.call(error) == '[object Error]') {
                this.logData.errorMessage = error.message;
                this.logData.errors.push(error.message);
            }
            else if (error) {
                this.logData.errorMessage = error.toString();
                this.logData.errors.push(error.toString());
            }
        }
        catch(err)
		{
			this.logData.errors.push("Error attempting to resolve error.  It's a meta-error");
		}
	// This.syslog(msg, execPoint, status, error);
	var logOutput = "";
	if (this.logConfig.mode == 'json')
	{
		
		var logJSON = {};
		logJSON.envelope = {};
		logJSON.envelope.datestamp = datestamp;
		logJSON.envelope.ID = this.logData.ID;
		logJSON.envelope.status = status;
		logJSON.envelope.execPoint = execPoint;
		logJSON.envelope.error = (error ? error.message : '');
		logJSON.msg = msg;
		//logOutput = JSON.stringify(logJSON);
		logOutput = JSON.stringify(logJSON,null,2);

	}
	else if(this.columnizer)
	{
		logOutput = (this.logConfig.color ? this.logConfig.color : '') + this.columnizer.columnify({data: [datestamp, (this.logData.ID ? this.logData.ID : 'no ID'), status, execPoint, msg, (error ? error.message : '')]});
		//console.log((this.logConfig.color ? this.logConfig.color : '') + this.columnizer.columnify({data: [datestamp, (this.logData.ID ? this.logData.ID : 'no ID'), status, execPoint, msg, (error ? error.message : '')]}));
	}
	else
	{
		logOutput = (this.logConfig.color ? this.logConfig.color : '') + datestamp + "\t" + (this.logData.ID ? this.logData.ID : 'no ID') + "\t" + status  + "\t" + execPoint + "\t" + msg + "\t" + (error ? error.message : '');
		//console.log((this.logConfig.color ? this.logConfig.color : '') + datestamp + "\t" + (this.logData.ID ? this.logData.ID : 'no ID') + "\t" + status  + "\t" + execPoint + "\t" + msg + "\t" + (error ? error.message : ''));
	}
	console.log(logOutput);
	this.writeToFile(this.logConfig.logPath, logOutput);
	//this.flushToFile();
};


Logger.prototype.append = function(objToAppend)
{
	this.logData = extend(this.logData, objToAppend);
};

Logger.prototype.prepend = function(objsToPrepend, key)
{
	var newLogData = {};
	var prependedData = {};
	var origLogData = JSON.parse(JSON.stringify(this.logData));
	for(i = 0;i < objsToPrepend.length;i++)
	{
        prependedData = extend(prependedData, objsToPrepend[i])
    }
    newLogData[key]=prependedData;

	this.logData = extend(newLogData, this.logData);

};

Logger.prototype.getLog = function(pathsToRedact, redactPhrase)
{
    if(!pathsToRedact)
	{
		return this.logData;
	}
	var data = this.logData;
	    for(var i = 0;i < pathsToRedact.length;i++)
        {
            jpp(data).set(pathsToRedact[i], redactPhrase);
        }
    return data;
};

Logger.prototype.endlog = function (path, pathsToRedact, redactPhrase) {
	this.flushToFile(path, pathsToRedact,redactPhrase);
};

Logger.prototype.flushToFile = function(path, pathsToRedact, redactPhrase)
{
    var logContent = JSON.stringify(this.getLog(pathsToRedact, redactPhrase));

    fs.writeFile(this.logConfig.logPath, logContent, err => {
        if (err) {
            // Console.log("Error writing job log to file: " + err)
            const e = {message: 'Error writing job log to file' + err};
            throw (e);
        }
    });
};

Logger.prototype.syslog = function (msg, execPoint, status, error) {
    if(!msg == 'undefined')
    {
        msg = "no msg supplied";
    }
    if(!execPoint)
    {execPoint = "no execPoint supplied";};
    if(!status)
    {
        status = "no status supplied";
    }
	const datestamp = format(new Date());
	const logString = (this.columnizer ? this.columnizer.columnify({data: [datestamp, (this.logData.ID ? this.logData.ID : 'no ID'), status, execPoint, msg, (error ? error.message : '')]})
								  : datestamp + "\t" + status + "\t" + execPoint + "\t" + msg + "\t" + (error ? error.message : ""));
   console.log((this.logConfig.color ? this.logConfig.color : '') + logString);
   this.writeToFile(this.logConfig.syslogPath, logString);

   /*		
   if (fs.existsSync(this.logConfig.syslogPath)) {
		fs.appendFile(this.logConfig.syslogPath, '\n' + logString, err => {
			if (err) {
				console.log('Error appending to SYSLOG: ' + err);
			}
		});
	} else {
		fs.writeFile(this.logConfig.syslogPath, logString, err => {
			if (err) {
				console.log('Error writing to SYSLOG: ' + err);
			}
		});
	}
	*/
};

Logger.prototype.writeToFile = function (path, outputString) {
	
	if (fs.existsSync(path)) {
		fs.appendFile(path, '\n' + outputString, err => {
			if (err) {
				console.log('Error appending to SYSLOG: ' + err);
			}
		});
	} else {
		fs.writeFile(path, outputString, err => {
			if (err) {
				console.log('Error writing to SYSLOG: ' + err);
			}
		});
	}



}

