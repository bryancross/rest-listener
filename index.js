const RL = require('./rest-listener.js');
//var http = require('http');

//var config = require('./config/config.json');
//var argPAT = '';
var httpOptions = {
    port: (process.env.PORT || 3000),
    host: 'localhost'
};

console.log("ARGS: " + process.argv);

startup();

function startup()
{
    console.log("starting rest-listener");
    const rt = new RL();
}