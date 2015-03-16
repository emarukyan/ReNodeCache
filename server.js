var http	=	require('http');
var redis	=	require("redis");
var url		=	require('url');
var async	=	require('async');

var __req_num = 1;
var __req_num_local = 1;
var __ask_storage = 0;	//how many times we have asked storage for content
var begin = new Date(); 	//for calculating requests per second
var end = new Date();
var __current_rps = 0;
var __cache_rebuild = [];


var __SETTINGS = [];
__SETTINGS['CACHE_RECHECK_TIMEOUT'] = 30; //miliseconds
__SETTINGS['CACHE_REBUILD_ARRAY_MAX_SIZE'] = 5000; //entries of array
__SETTINGS['CALC_RPS_EACH_N_REQUESTS'] = 300; //print stats each 300 requests
__SETTINGS['PAGE_EXPIRE_SECONDS'] = 100;
__SETTINGS['NODE_SERVER_PORT'] = 8888; //SERVER PORT TO RUN
__SETTINGS['RPS_UPPER_LIMIT_ERROR'] = 150;

//CREATE A REDIS CLIENT
var redis_client = redis.createClient();
redis_client.on("error", function (err) {
	consolog("Error " + err);
});


//Calculates Current RPS, and prints useful statistics
function statCalculator(){
	//calculate current rps
	if( __req_num_local == __SETTINGS['CALC_RPS_EACH_N_REQUESTS'] ) {
		//calculate requests per second
		end = new Date();
		__current_rps = (__req_num_local / ((end - begin)/1000)).toFixed(1);

		//print statistics
		consolog('\n\nIncoming Connections: ' + __req_num );
		consolog('Ask from storage: ' + __ask_storage);
		consolog('Cache hit rate: ' + Math.round((__req_num - __ask_storage)*100/__req_num,1) + '%');
		consolog('Requests per second: ' + __current_rps + ', Seconds: ' + ((end - begin)/1000).toFixed(3) + ', Requests: ' + __req_num_local + '\n');

		__req_num_local = 1;
		begin = new Date();

		//drop cache rebuilt array
		if( __cache_rebuild.length > __SETTINGS['CACHE_REBUILD_ARRAY_MAX_SIZE'] && __current_rps < 100 ) {
			__cache_rebuild = []; 
		}
	}

	__req_num++;
	__req_num_local++;
}


function processRequest(request, response) {
	if(request.method == "GET") {
		var url_parts = url.parse(request.url, true);
		var query_params = url_parts.query;
		var hostname = getHostName(request.headers.host);

		var page_path = "http://" + hostname + url_parts.path;
		consolog('\nPage Request: ' + page_path)
		getPage(page_path, function(err, content){
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.end(content || '');
		});
	} else if(request.method == "POST") {
		response.end('');
	}
}


function getPageFromStorage(page_path, callback){
	//Ask page from storage!
	consolog('Asking from storage: ' + page_path);
	__ask_storage++;

	var storage_request = require('request');
	storage_request(page_path, function (error, storage_response, body) {
		if (!error && storage_response.statusCode == 200) {
			consolog('Got response from storage:' + storage_response.statusCode)
			callback(null, body);
		}else{
			consolog('Error from storage')
			consolog(error)
			callback(error, '');
		}
	});
}

function buildCache(page_path, page_key, callback){
	if( __cache_rebuild[page_key] == true ) {
		setTimeout(__SETTINGS['CACHE_RECHECK_TIMEOUT'], buildCache, page_path, page_key, callback);
		return;
	}

	__cache_rebuild[page_key] = true;
	getPageFromStorage(page_path, function(err, page_content){
		if( err ) {
			consolog(err);
			callback(err, '');
		}else{
			redis_client.setex(page_key, __SETTINGS['PAGE_EXPIRE_SECONDS'], page_content, function(err){
				//TODO: handle redis error
				__cache_rebuild[page_key] = false;
				callback(null, page_content)
			});
		}
	})
}

function getPage(page_path, maincallback){
	var page_key = page_path.replace('http://', 'Page:');

	async.waterfall([
		function(callback){
			redis_client.get(page_key, function(err, redis_reply) {
				//TODO: Handle Error
				if( redis_reply == null ) {
					//No cache, ask from storage
					consolog('Cache empty for page: ' + page_path);
					buildCache(page_path, page_key, function(err, content){
						consolog('Chache is built');
						callback(err, content);
					});
				}else{
					//page cache exists
					consolog('Page cached: ' + page_path);
					callback(null, redis_reply);
				}
			})
		},
	], function(err, page_content){
		if (err ) {
			consolog("getPage: Waterfall: ERROR")
			consolog(err)
		}else{
			consolog("Success: page content")
		}
		maincallback(err, page_content);
	})
}


function consolog(msg){
	console.log(msg);
}

function getHostName(host){
	return ( host.match(/:/g) ) ? host.slice( 0, host.indexOf(":") ) : host;
}


http.createServer(function (req, res) {
	statCalculator();
	processRequest(req, res);
}).listen(__SETTINGS['NODE_SERVER_PORT']);


